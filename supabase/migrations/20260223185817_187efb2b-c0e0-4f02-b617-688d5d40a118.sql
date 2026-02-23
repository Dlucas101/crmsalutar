
-- Add endereco to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS endereco text;

-- Create custom_roles table for user-defined member roles/functions
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view custom_roles"
  ON public.custom_roles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage custom_roles"
  ON public.custom_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert custom_roles"
  ON public.custom_roles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add custom_role_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES public.custom_roles(id);

-- Add responsible_id to leads (profile reference for the responsible member)  
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS responsible_id uuid;
