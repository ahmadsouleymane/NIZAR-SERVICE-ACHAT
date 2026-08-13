-- ============================================================
-- Reçus de plein : plusieurs photos par plein (au lieu d'une seule).
-- Ré-exécutable. On garde receipt_photo_path (compat) et on ajoute un tableau.
-- ============================================================

alter table public.fuelings
  add column if not exists receipt_photo_paths text[] not null default '{}';

-- Migre l'éventuelle photo unique existante vers le tableau.
update public.fuelings
set receipt_photo_paths = array[receipt_photo_path]
where receipt_photo_path is not null
  and receipt_photo_path <> ''
  and (receipt_photo_paths is null or array_length(receipt_photo_paths, 1) is null);
