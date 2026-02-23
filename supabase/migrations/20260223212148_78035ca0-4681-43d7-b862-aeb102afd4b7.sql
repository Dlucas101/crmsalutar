
-- Trigger: when lead status changes to 'fechado_ganho', auto-create client + project
CREATE OR REPLACE FUNCTION public.handle_lead_ganho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_client_id uuid;
  new_project_id uuid;
BEGIN
  -- Only fire when status changes TO fechado_ganho
  IF NEW.status = 'fechado_ganho' AND (OLD.status IS DISTINCT FROM 'fechado_ganho') THEN
    -- Check if client already exists for this lead
    SELECT id INTO new_client_id FROM public.clients WHERE lead_id = NEW.id;
    
    IF new_client_id IS NULL THEN
      -- Create client from lead data
      INSERT INTO public.clients (nome, email, whatsapp, cnpj_cpf, endereco, lead_id)
      VALUES (NEW.nome, NEW.email, NEW.whatsapp, NULL, NEW.endereco, NEW.id)
      RETURNING id INTO new_client_id;
    END IF;

    -- Check if project already exists for this client
    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE client_id = new_client_id) THEN
      -- Create project
      INSERT INTO public.projects (nome, client_id, status, descricao)
      VALUES (
        'Projeto - ' || NEW.nome,
        new_client_id,
        'backlog',
        COALESCE(NEW.interesse, '')
      )
      RETURNING id INTO new_project_id;

      -- Create default tasks for the project
      INSERT INTO public.tasks (title, project_id, status, priority, assigned_user_id) VALUES
        ('Reunião inicial com o cliente', new_project_id, 'a_fazer', 'alta', NEW.responsible_id),
        ('Levantamento de requisitos', new_project_id, 'a_fazer', 'alta', NEW.responsible_id),
        ('Elaborar proposta técnica', new_project_id, 'a_fazer', 'media', NEW.responsible_id),
        ('Kickoff do projeto', new_project_id, 'a_fazer', 'media', NEW.responsible_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Attach trigger to leads table
DROP TRIGGER IF EXISTS on_lead_ganho ON public.leads;
CREATE TRIGGER on_lead_ganho
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lead_ganho();
