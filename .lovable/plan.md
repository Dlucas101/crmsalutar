

## Reformulação da Tela de Tarefas e Automações

### Resumo

Substituir o layout Kanban por uma lista simples com duas abas ("Pendentes" e "Concluídas"), e alterar as automações do banco de dados para criar tarefas específicas vinculadas ao lead em dois momentos: quando o lead é criado (status "novo") e quando muda para "Ganho".

---

### 1. Alterar o trigger do banco de dados

Atualizar a função `handle_lead_ganho` e criar um novo trigger para INSERT na tabela leads:

**Novo trigger - Quando lead é criado (status "novo"):**
- Criar 1 tarefa: **"Visita a cliente agendada?"**
- Vinculada ao lead via `lead_id`
- Atribuída ao `responsible_id` do lead

**Trigger atualizado - Quando lead muda para "fechado_ganho":**
- Manter a criação do cliente (como já funciona)
- Remover as 4 tarefas antigas
- Criar 3 novas tarefas vinculadas ao lead:
  1. **"Sistema instalado e configurado?"**
  2. **"1° Treinamento agendado?"**
  3. **"2° Treinamento agendado?"**

---

### 2. Redesenhar a tela de Tarefas (`src/pages/Tarefas.tsx`)

Substituir o Kanban por uma interface com duas abas:

- **Aba "Pendentes"**: lista de tarefas com status diferente de "concluido"
- **Aba "Concluídas"**: lista de tarefas com status "concluido"

Cada tarefa mostrará:
- Titulo da tarefa
- Nome do lead vinculado (buscar via join com tabela leads)
- Botao "Feito" (muda status para "concluido") na aba Pendentes
- Botao "Desfazer" (volta para "a_fazer") na aba Concluidas

---

### Detalhes Tecnico

**Migração SQL:**

```sql
-- 1. Trigger para lead novo (INSERT)
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

-- 2. Atualizar trigger de ganho (remover tarefas antigas, criar novas)
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
```

**Frontend - `src/pages/Tarefas.tsx`:**
- Remover layout Kanban
- Usar componente `Tabs` (Pendentes / Concluidas)
- Buscar tarefas com join: `tasks` + `leads(nome)` para mostrar o nome do lead
- Botao "Feito" chama update de status para "concluido"
- Botao "Desfazer" volta para "a_fazer"

