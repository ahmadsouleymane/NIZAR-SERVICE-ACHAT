# Migrations Supabase

Appliquer dans l'ordre, dans le SQL Editor de Supabase (Table Editor > SQL) :

1. `0001_init.sql` — tables, RLS, fonctions `is_admin`/`is_agent`, politiques de stockage.
2. `0002_fix_rls.sql` — **correctif** : recrée les politiques d'écriture avec les fonctions
   sécurisées et autorise l'upload des photos sur le bucket `plannings`
   (à exécuter si un ancien schéma refuse les insertions / l'upload).

Créer ensuite un bucket de stockage nommé `plannings`, en mode **public**,
pour conserver les photos des plannings.
