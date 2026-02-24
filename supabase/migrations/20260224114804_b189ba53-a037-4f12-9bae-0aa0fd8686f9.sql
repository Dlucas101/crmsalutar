-- 1. Trigger para lead novo (INSERT) - cria tarefa "Visita a cliente agendada?"
CREATE OR REPLACE FUNCTION public.handle_lead_novo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status = 'novo' THEN
    INSERT INTO public.tasks (title, lead_id, status, priority, assigned_user_id)
    VALUES ('Visita a cliente agendada?', NEW.id, 'a_fazer', 'alta', NEW.responsible_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_lead_novo ON public.leads;
CREATE TRIGGER on_lead_novo
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_lead_novo();

-- 2. Atualizar trigger de ganho - criar cliente + 3 tarefas novas
CREATE OR REPLACE FUNCTION public.handle_lead_ganho()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
DECLARE
  new_client_id uuid;
BEGIN
  IF NEW.status = 'fechado_ganho' AND (OLD.status IS DISTINCT FROM 'fechado_ganho') THEN
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
  END IF;
  RETURN NEW;
END;
$function$;
