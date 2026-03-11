ALTER TABLE public.metas
ADD COLUMN meta_bonus_quantidade integer DEFAULT 0,
ADD COLUMN meta_bonus_valor numeric DEFAULT 0,
ADD COLUMN meta_bonus_descricao text DEFAULT NULL;