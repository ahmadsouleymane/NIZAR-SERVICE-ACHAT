# Système de gestion du service d'achat — Transport

**Date :** 06/08/2026
**Statut :** Validé avec l'utilisateur

## 1. Contexte et objectifs

Entreprise de transport routier au Niger (lignes Agadez, Arlit, Niamey, Maradi, Zinder, Gaya, Tahoua, Dosso, Diffa, etc.).

Chaque jour, un planning des départs est imprimé sur papier (une ou plusieurs feuilles : « DEPART AGADEZ », « DEPART ARLIT », « PLANNING DU VOYAGE DEPART NIAMEY », etc.). Le planning liste les départs avec : axe, n° de bus, heure de départ, chauffeur titulaire, chauffeur suppléant (souvent « NEANT »), téléphone titulaire, téléphone suppléant (souvent « NEANT »).

Le **service d'achat** doit :
1. Connaître les départs prévus pour aujourd'hui.
2. Suivre le plein de carburant de chaque bus **avant son départ**.
3. Enregistrer chaque plein sous forme de reçu : le véhicule se remplit automatiquement à partir du départ, et le prix actuel du carburant s'applique.
4. Calculer automatiquement le montant de chaque plein et le **grand total** de la journée.
5. Suivre le règlement (statut payé / non payé).

### Objectifs de la version 1

- Scanner les feuilles de planning imprimées et extraire les données automatiquement (moteur OCR gratuit, dans le navigateur).
- Consulter les départs d'une date donnée (aujourd'hui par défaut).
- Enregistrer les pleins de carburant avec prix automatique et grand total.
- Marquer les reçus comme payés.
- Gérer plusieurs utilisateurs (rôles admin / agent) via une authentification.
- Interface **propre, simple, responsive desktop + mobile**, sans complexité inutile.

### Hors périmètre v1 (v2+)

- Impression/export PDF des reçus.
- Statistiques avancées / tableaux de bord.
- Gestion de la maintenance des bus ou des stocks de pièces.
- Notifications automatiques.

## 2. Utilisateurs et rôles

| Rôle | Droits |
|---|---|
| **Admin** | Tout : gérer les prix essence/diesel, gérer les utilisateurs, scanner/valider les plannings, enregistrer et payer les reçus. |
| **Achat** (agent) | Voir les départs, enregistrer les reçus de plein, marquer payé. Ne gère ni les prix ni les utilisateurs. |

## 3. Stack technique

- **Frontend :** Next.js (App Router, TypeScript, Tailwind CSS), responsive, déployé sur **Vercel**.
- **Base de données :** **Supabase** (Postgres) + **Auth** (email/mot de passe) + **Storage** (photos des plannings).
- **OCR :** **Tesseract.js** (WebAssembly), exécution 100 % côté navigateur. Aucun serveur OCR, aucun compte, aucun coût.
- **Monnaie :** francs CFA (FCFA), entiers.

## 4. Modèle de données

### `profiles`
- `id` uuid PK (réf. `auth.users`)
- `full_name` text
- `role` enum : `admin` | `achat`

### `plannings`
- `id` uuid PK
- `date` date (jour du planning)
- `source_label` text (ex. « Agadez/Niamey », libre)
- `image_urls` text[] (photos scannées conservées dans Storage)
- `created_by` uuid FK `profiles`
- `created_at` timestamptz

### `departures`
- `id` uuid PK
- `planning_id` uuid FK `plannings`
- `axis` text (ex. « AGADEZ - NIAMEY SPECIAL »)
- `bus_number` text (ex. « CG 6377 »)
- `departure_time` text (ex. « 05 H 00 », « NUIT ») — conservé tel quel pour respecter les formats des feuilles
- `driver_name` text
- `driver_phone` text
- `backup_driver` text nullable (vide si « NEANT »)
- `backup_phone` text nullable

### `fuel_prices`
- `id` uuid PK
- `fuel_type` enum : `essence` | `diesel`
- `price` integer (FCFA par litre)
- `effective_date` date
- `created_by` uuid FK `profiles`
- Prix actuel d'un type = dernier `effective_date` (à date ≤ aujourd'hui)

### `fuelings` (reçus de plein)
- `id` uuid PK
- `date` date
- `departure_id` uuid FK `departures` (nullable — un plein peut être saisi manuellement sans départ)
- `bus_number` text
- `driver_name` text nullable
- `fuel_type` enum : `essence` | `diesel`
- `liters` numeric (décimale, ex. 300.5)
- `unit_price` integer — **copié** du prix actuel au moment de la saisie
- `amount` numeric — `liters × unit_price`, calculé automatiquement
- `paid` boolean (défaut `false`)
- `paid_at` timestamptz nullable
- `recorded_by` uuid FK `profiles`
- `created_at` timestamptz

## 5. Écrans et navigation

Barre de navigation basse (mobile) / latérale (desktop) : **Départs · Scanner · Historique · Admin**.

### 5.1 Connexion
- Email + mot de passe (Supabase Auth).
- Aucune inscription libre : les utilisateurs sont créés par l'admin.

### 5.2 Départs du jour (écran principal)
- Sélecteur de date (aujourd'hui par défaut).
- Liste des départs du jour, groupés par ville d'origine (extrait de l'axe, ex. « AGADEZ - NIAMEY » → groupe Agadez).
- Chaque ligne : heure, axe, n° bus, chauffeur, et un **indicateur de statut carburant** :
  - ⚪ pas de plein · ⛽ plein fait · ✅ payé
- **En-tête de journée** : grand total des pleins de la date, et bouton « Tout payer ».

### 5.3 Scanner un planning
- Sélecteur de date + libellé source (ex. « Feuille Agadez »).
- Upload de 1..N photos (webcam ou fichier).
- Tesseract.js lit le texte avec coordonnées → parseur reconstruit les colonnes.
- **Aperçu éditable** (tableau) : chaque ligne modifiable, suppression de lignes parasites.
- Bouton « Enregistrer » → création du `planning` + `departures`.
- En cas de date déjà existante : confirmation « Ajouter à ce planning » / « Annuler ».
- En cas d'échec de lecture : bouton « Réessayer » ou bascule en saisie manuelle.

### 5.4 Historique des plannings
- Liste par date décroissante.
- Ouvrir un planning = vue du tableau des départs, photo(s) consultable(s).
- Suppression d'un planning (admin) avec confirmation.

### 5.5 Reçus carburant (intégré à 5.2)
- Depuis une ligne de départ : formulaire compact — type (essence/diesel), litres.
- Bus et chauffeur pré-remplis ; prix actuel du type affiché et appliqué.
- Montant calculé en direct ; ajout au grand total.
- Un départ peut recevoir plusieurs pleins (somme affichée).
- Bouton « Payer » par reçu ; « Tout payer » pour la journée.

### 5.6 Historique des reçus
- Filtres : date, type de carburant, statut payé/non payé.
- Totaux affichés ; liste des reçus avec montants.
- Export CSV : uniquement si l'implémentation reste triviale, sinon reporté en v2.

### 5.7 Admin
- **Prix carburant :** table essence/diesel — prix actuel modifiable, historique visible (dates d'effet).
- **Utilisateurs :** créer un compte (email, nom, mot de passe, rôle), lister, désactiver, changer le rôle.
- Informations simples d'usage.

## 6. Flux de scan OCR (Tesseract.js)

1. Upload de la photo (canvas redimensionné si besoin pour la qualité).
2. Appel `Tesseract.recognize` (langue `fra`) avec sortie incluant les coordonnées (mots + lignes).
3. **Parseur de tableau** :
   - Regrouper les mots par ligne (positions Y proches).
   - Identifier les en-têtes de section (« DEPART AGADEZ », « PLANNING DU VOYAGE DEPART NIAMEY ») → origine/ville.
   - Déduire la date de l'image si possible (sinon saisie manuelle).
   - Mapper les colonnes par positions X : Axe / N° Bus / Heure / Chauffeur / Téléphone.
   - Colonnes « NEANT » → valeurs vides.
   - Heure « NUIT » conservée telle quelle.
   - L'axe peut occuper une colonne large ; les codes type « CG 6377 » suivent le motif `[A-Z]{2} \d{4}` ; les téléphones `\d{7,8}`. Ces motifs aident au parsing et à la validation.
4. **Validation humaine obligatoire** : aperçu en tableau éditable avant tout enregistrement.
5. Enregistrement → `planning` + `departures`, photos stockées.

## 7. Flux carburant détaillé

1. L'agent ouvre « Aujourd'hui » (ou une autre date).
2. Un bus se présente : l'agent touche la ligne du départ.
3. Le système pré-remplit bus + chauffeur ; l'agent choisit le type (essence/diesel) et saisit les litres.
4. Le prix actuel du type s'applique (lecture de `fuel_prices`) ; montant = litres × prix.
5. Le reçu est enregistré ; le grand total de la journée se met à jour.
6. En fin de journée, l'agent règle : bouton « Tout payer » (ou par reçu) → `paid = true`, `paid_at = now()`.

## 8. Règles métier et cas particuliers

- **Prix copié sur le reçu** : modifier le prix plus tard ne modifie pas les reçus existants.
- **Même bus, plusieurs départs le même jour** (ex. BH 8212 Agadez–Ingal 10h puis Ingal–Agadez 14h) : chaque départ possède ses propres reçus.
- **Un départ peut avoir plusieurs pleins** : la somme est affichée.
- **Photo floue / extraction incomplète** : réessayer, ou saisie manuelle de secours.
- **Deux scans pour la même date** : confirmation « ajouter » avant d'insérer.
- **Téléphones et bus manquants** : champs optionnels, pas de blocage.
- **Grand total** = somme des `amount` des reçus de la date (tous statuts confondus) ; le « payé » est le suivi de règlement, pas un calcul.

## 9. Sécurité (RLS Supabase)

- Authentification obligatoire.
- Row Level Security :
  - Lecture des `plannings`, `departures`, `fuelings` : tout utilisateur authentifié.
  - Écriture des `fuelings` : admin + achat.
  - Lecture/écriture `fuel_prices`, `profiles`, suppression `plannings` : admin uniquement.
- `profiles` : insertions uniquement via une fonction sécurisée (l'admin ne doit pas pouvoir se créer librement ; dans la v1, la création se fait côté admin avec la clé de service, ou via une fonction protégée par le rôle admin).

## 10. Principes UI/UX

- **Simple et épuré** : un écran = une tâche. Zéro fonctionnalité cachée.
- **Responsive** : mobile (navigation basse, cartes/lignes pleine largeur) et desktop (navigation latérale, tableaux denses).
- **Très instructif** : libellés explicites en français (« Pas de plein », « Plein fait », « Payé »), prix et montants toujours affichés (FCFA), totaux bien visibles.
- **Feedback immédiat** : montant recalculé à la frappe, grand total mis à jour en direct, statuts visuels clairs (pastilles colorées).
- **Gros boutons tactiles** sur mobile ; raccourcis clavier sur desktop (optionnel).
- Typographie lisible, contrastes élevés, aucun jargon technique.

## 11. Tests

- **Parseur OCR** : tests unitaires sur des textes simulés avec coordonnées (fixtures inspirées des vraies feuilles) → vérifier la reconstruction des lignes/colonnes.
- **Calculs carburant** : litres × prix = montant ; somme des reçus = grand total.
- **Règles métier** : prix copié à la saisie, plusieurs pleins par départ.
- **RLS** : vérifier que l'agent ne peut pas modifier les prix.
- **E2E** (navigateur) : connexion → scanner (avec image de test) → validation → saisie d'un plein → total → payer.

## 12. Configuration requise

- Compte Vercel + projet Supabase (gratuits).
- Variables d'environnement : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (fonctions admin), `SUPABASE_DB_URL` (migrations).
- Aucune clé OCR (Tesseract.js est local).
