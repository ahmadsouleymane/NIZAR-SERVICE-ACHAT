# Service d'achat — Gestion des départs et du carburant

Application web pour le service d'achat d'une entreprise de transport (Niger).

## Fonctionnalités

- Scanner les plannings de départs (photos) et extraire les données automatiquement (OCR gratuit dans le navigateur, Tesseract.js).
- Valider et corriger les données avant enregistrement.
- Consulter les départs d'une date, groupés par ville.
- Enregistrer les pleins de carburant (essence/diesel) avec prix automatique et montant calculé.
- Grand total de la journée et suivi payé / non payé.
- Historique des plannings et des reçus.
- Multi-utilisateurs (admin / service achat).

## Stack

- Next.js (App Router) + TypeScript + Tailwind, déployé sur Vercel
- Supabase : base Postgres, authentification, stockage
- Tesseract.js : OCR 100 % navigateur

## Démarrage

1. `cp .env.local.example .env.local` puis renseigner les variables Supabase.
2. Appliquer la migration `supabase/migrations/0001_init.sql` dans le SQL Editor Supabase.
3. Créer un bucket de stockage public `plannings`.
4. `npm install`
5. `npm run dev`

## Déploiement Vercel

1. Pousser le dépôt sur GitHub et l'importer dans Vercel.
2. Renseigner les variables d'environnement.
3. Le premier utilisateur doit être créé directement dans Supabase (Authentication > Users) — son profil `admin` se règle ensuite en base ou via la console.

---

## 👤 Auteur

**Ahmad Souleymane** — [@ahmadsouleymane](https://github.com/ahmadsouleymane)
