CREATE TABLE IF NOT EXISTS public.trigger_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_name text NOT NULL,
  function_name text NOT NULL,
  table_name text NOT NULL DEFAULT 'leads',
  event_type text NOT NULL,
  user_id uuid NULL,
  lead_id uuid NULL,
  status_before text NULL,
  status_after text NULL,
  success boolean NOT NULL DEFAULT true,
  error_message text NULL,
  error_details text NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trigger_audit_created_at ON public.trigger_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trigger_audit_lead_id ON public.trigger_audit (lead_id);
CREATE INDEX IF NOT EXISTS idx_trigger_audit_user_id ON public.trigger_audit (user_id);
CREATE INDEX IF NOT EXISTS idx_trigger_audit_trigger_name ON public.trigger_audit (trigger_name);
CREATE INDEX IF NOT EXISTS idx_trigger_audit_success ON public.trigger_audit (success);

ALTER TABLE public.trigger_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trigger_audit_select_admin ON public.trigger_audit;
CREATE POLICY trigger_audit_select_admin
ON public.trigger_audit
FOR SELECT
TO authenticated
USING (public.is_admin_or_gestor(auth.uid()));

REVOKE ALL ON TABLE public.trigger_audit FROM anon, public;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.trigger_audit FROM authenticated;
GRANT SELECT ON TABLE public.trigger_audit TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin_or_gestor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_gestor(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;

CREATE OR REPLACE FUNCTION public.record_trigger_audit(
  _trigger_name text,
  _function_name text,
  _table_name text,
  _event_type text,
  _user_id uuid,
  _lead_id uuid,
  _status_before text,
  _status_after text,
  _success boolean,
  _error_message text DEFAULT NULL,
  _error_details text DEFAULT NULL,
  _data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.trigger_audit (
    trigger_name,
    function_name,
    table_name,
    event_type,
    user_id,
    lead_id,
    status_before,
    status_after,
    success,
    error_message,
    error_details,
    data
  ) VALUES (
    _trigger_name,
    _function_name,
    _table_name,
    _event_type,
    _user_id,
    _lead_id,
    _status_before,
    _status_after,
    _success,
    _error_message,
    _error_details,
    COALESCE(_data, '{}'::jsonb)
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_trigger_audit(text, text, text, text, uuid, uuid, text, text, boolean, text, text, jsonb) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.record_trigger_audit(text, text, text, text, uuid, uuid, text, text, boolean, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.set_lead_won_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'fechado_ganho' AND (OLD.status IS DISTINCT FROM 'fechado_ganho') THEN
    NEW.won_at = now();
    PERFORM public.record_trigger_audit(
      'trg_set_lead_won_at',
      'set_lead_won_at',
      TG_TABLE_NAME,
      TG_OP,
      auth.uid(),
      NEW.id,
      OLD.status,
      NEW.status,
      true,
      NULL,
      NULL,
      jsonb_build_object('won_at', NEW.won_at)
    );
  ELSIF NEW.status <> 'fechado_ganho' AND OLD.status = 'fechado_ganho' THEN
    NEW.won_at = NULL;
    PERFORM public.record_trigger_audit(
      'trg_set_lead_won_at',
      'set_lead_won_at',
      TG_TABLE_NAME,
      TG_OP,
      auth.uid(),
      NEW.id,
      OLD.status,
      NEW.status,
      true,
      NULL,
      NULL,
      jsonb_build_object('won_at', NEW.won_at)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM public.record_trigger_audit(
    'trg_set_lead_won_at',
    'set_lead_won_at',
    TG_TABLE_NAME,
    TG_OP,
    auth.uid(),
    NEW.id,
    OLD.status,
    NEW.status,
    false,
    SQLERRM,
    SQLSTATE,
    '{}'::jsonb
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_lead_won_at_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'fechado_ganho' AND NEW.won_at IS NULL THEN
    NEW.won_at = now();
    PERFORM public.record_trigger_audit(
      'trg_set_lead_won_at_insert',
      'set_lead_won_at_insert',
      TG_TABLE_NAME,
      TG_OP,
      auth.uid(),
      NEW.id,
      NULL,
      NEW.status,
      true,
      NULL,
      NULL,
      jsonb_build_object('won_at', NEW.won_at)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM public.record_trigger_audit(
    'trg_set_lead_won_at_insert',
    'set_lead_won_at_insert',
    TG_TABLE_NAME,
    TG_OP,
    auth.uid(),
    NEW.id,
    NULL,
    NEW.status,
    false,
    SQLERRM,
    SQLSTATE,
    '{}'::jsonb
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_lead_ganho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_client_id uuid;
BEGIN
  IF NEW.status = 'fechado_ganho' AND (OLD.status IS DISTINCT FROM 'fechado_ganho') THEN
    BEGIN
      SELECT id INTO new_client_id FROM public.clients WHERE lead_id = NEW.id;
      IF new_client_id IS NULL THEN
        INSERT INTO public.clients (nome, email, whatsapp, endereco, lead_id)
        VALUES (NEW.nome, NEW.email, NEW.whatsapp, NEW.endereco, NEW.id)
        RETURNING id INTO new_client_id;
      END IF;

      INSERT INTO public.tasks (title, lead_id, status, priority, assigned_user_id) VALUES
        ('Sistema instalado e configurado?', NEW.id, 'a_fazer', 'alta', NEW.responsible_id),
        ('1° Treinamento agendado?', NEW.id, 'a_fazer', 'alta', NEW.responsible_id),
        ('2° Treinamento agendado?', NEW.id, 'a_fazer', 'media', NEW.responsible_id);

      PERFORM public.record_trigger_audit(
        'on_lead_ganho',
        'handle_lead_ganho',
        TG_TABLE_NAME,
        TG_OP,
        auth.uid(),
        NEW.id,
        OLD.status,
        NEW.status,
        true,
        NULL,
        NULL,
        jsonb_build_object('client_id', new_client_id, 'tasks_created', 3)
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.record_trigger_audit(
        'on_lead_ganho',
        'handle_lead_ganho',
        TG_TABLE_NAME,
        TG_OP,
        auth.uid(),
        NEW.id,
        OLD.status,
        NEW.status,
        false,
        SQLERRM,
        SQLSTATE,
        '{}'::jsonb
      );
    END;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_lead_novo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'novo' THEN
    BEGIN
      INSERT INTO public.tasks (title, lead_id, status, priority, assigned_user_id)
      VALUES ('Visita a cliente agendada?', NEW.id, 'a_fazer', 'alta', NEW.responsible_id);

      PERFORM public.record_trigger_audit(
        'on_lead_novo',
        'handle_lead_novo',
        TG_TABLE_NAME,
        TG_OP,
        auth.uid(),
        NEW.id,
        NULL,
        NEW.status,
        true,
        NULL,
        NULL,
        jsonb_build_object('tasks_created', 1)
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.record_trigger_audit(
        'on_lead_novo',
        'handle_lead_novo',
        TG_TABLE_NAME,
        TG_OP,
        auth.uid(),
        NEW.id,
        NULL,
        NEW.status,
        false,
        SQLERRM,
        SQLSTATE,
        '{}'::jsonb
      );
    END;
  END IF;
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.handle_lead_ganho() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_lead_novo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_lead_won_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_lead_won_at_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_lead_ganho() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_lead_novo() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_lead_won_at() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_lead_won_at_insert() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, public;