# Liaison détaillée, calcul distance/consommation, reçu de carburant photo

## Contexte

Le scanner de planning capture déjà : numéro de bus, axe (texte brut), horaire, chauffeur
titulaire/suppléant et leurs téléphones (voir `docs/planning-template.md`). Le formulaire de
plein (`FuelingForm.tsx`) capture déjà la quantité, le type de carburant, le prix et le montant.

Ce qui manque, demandé par l'utilisateur (entreprise de transport au Niger, bus majoritairement
Yutong, diesel) :

1. Distinguer dans la liaison les villes de passage (ex. `NIAMEY - LOGA - AGADEZ`) d'un trajet
   direct (`NIAMEY - AGADEZ`) — ce sont deux itinéraires physiquement différents, pas la même
   route avec une étape en plus.
2. Calculer automatiquement la distance et la consommation de carburant prévisionnelle de chaque
   départ, à partir de son itinéraire.
3. Ajouter une photo du reçu de la station lors de la saisie d'un plein, archivée avec
   l'enregistrement (la saisie des litres reste manuelle, comme aujourd'hui).

## Hors périmètre

- OCR du contenu du reçu de station (montant/litres lus automatiquement) — écarté par
  l'utilisateur, les reçus n'ont pas de format fixe contrairement au planning.
- Taux de consommation par bus/modèle — l'utilisateur enverra plus tard les caractéristiques
  précises des bus Yutong ; on démarre avec un taux global ajustable.
- Distances non documentées (voir ci-dessous) : laissées à saisir par l'utilisateur, jamais
  inventées.

## 1. Modèle de données

### Table `route_segments` (nouvelle)

Tronçon de route réel entre deux villes, non orienté (un trajet aller-retour utilise la même
ligne). Un itinéraire multi-villes se calcule en additionnant les tronçons consécutifs de sa
chaîne — ce qui distingue naturellement un trajet direct d'un trajet via une ville de passage,
même entre les mêmes origine/destination.

```sql
create table public.route_segments (
  id uuid primary key default gen_random_uuid(),
  city_a text not null,
  city_b text not null,
  distance_km numeric not null check (distance_km > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (city_a, city_b)
);
```

`city_a`/`city_b` stockées normalisées (majuscules, espaces compactés) via une fonction unique
`normalizeCityName(s: string): string` exportée par `src/lib/planning/route.ts`, utilisée à la
fois par `parseRoute` (axe scanné) et par `RoutesPanel` (saisie admin), pour garantir que les
deux se rejoignent toujours. La recherche d'un tronçon teste les deux sens (`city_a=A and
city_b=B`) ou (`city_a=B and city_b=A`).

Seed initial (migration), distances routières vérifiées par recherche web (sources concordantes,
arrondies au km) :

| Ville A | Ville B | km |
|---|---|---|
| NIAMEY | AGADEZ | 951 |
| NIAMEY | LOGA | 139 |
| LOGA | DOSSO | 73 |
| NIAMEY | DOSSO | 139 |
| DOSSO | DOGONDOUTCHI | 139 |
| DOGONDOUTCHI | KONNI | 147 |
| KONNI | TAHOUA | 133 |
| TAHOUA | AGADEZ | 398 |
| AGADEZ | ARLIT | 240 |
| NIAMEY | MARADI | 664 |
| MARADI | ZINDER | 238 |
| NIAMEY | ZINDER | 891 |
| NIAMEY | GAYA | 287 |

**Non inclus volontairement** : `LOGA ↔ AGADEZ` (suite de la route au nord de Loga) — aucune
source fiable trouvée. Tant que ce tronçon n'est pas renseigné dans Admin, un départ
`NIAMEY - LOGA - AGADEZ` n'affichera pas de distance (voir §3, gestion des tronçons manquants).

### Table `app_settings` (nouvelle)

Table clé/valeur générique pour des réglages simples (extensible sans migration future).

```sql
create table public.app_settings (
  key text primary key,
  value text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
```

Seed : `('consumption_l_per_100km', '30')` — taux global provisoire pour bus diesel type Yutong,
à ajuster dans Admin dès réception des specs réelles. `value` est stockée en texte (table
générique) ; le code lit `Number(value)` et traite un résultat `NaN`/`<= 0` comme un taux absent
(voir §"Gestion des erreurs").

### Table `fuelings` (modification)

```sql
alter table public.fuelings add column receipt_photo_url text;
```

Nullable : un plein reste valide sans photo (ex. saisie tardive, reçu perdu) — pas de blocage.

### RLS

- `route_segments`, `app_settings` : lecture pour tout utilisateur authentifié
  (`for select using (auth.role() = 'authenticated')`), écriture réservée admin
  (`with check (public.is_admin())`), même politique que `fuel_prices`.
- `fuelings.receipt_photo_url` : pas de politique dédiée, couvert par les policies déjà en place
  sur `fuelings` (agents insert/update).
- Nouveau bucket Storage `receipts` : mêmes policies que `plannings` (lecture publique, insert
  authentifié), voir `0002_fix_rls.sql` comme référence.

## 2. Parsing de l'itinéraire

Nouveau fichier `src/lib/planning/route.ts`.

```ts
export function parseRoute(axis: string): string[]
```

- Découpe `axis` sur `' - '` (même séparateur qu'`originOf` dans `parse.ts`).
- Filtre les tokens qui ne sont pas des noms de ville : `SPECIAL`, `REPOS`, `NUIT` (liste blanche
  fermée, extensible si d'autres suffixes apparaissent sur les feuilles réelles).
- Normalise chaque ville : `trim().toUpperCase()`, espaces multiples compactés.
- Renvoie `[]` si aucune ville identifiée (axe vide ou uniquement suffixes).

```ts
export interface RouteSegment { cityA: string; cityB: string; distanceKm: number }

export function computeDistanceKm(cities: string[], segments: RouteSegment[]): number | null
```

- Si `cities.length < 2` → `null` (itinéraire non déterminable).
- Pour chaque paire consécutive, cherche le tronçon (dans les deux sens) dans `segments`.
- Si un seul tronçon de la chaîne est introuvable → `null` pour tout l'itinéraire (on n'affiche
  jamais une distance partielle qui sous-estimerait silencieusement le trajet réel).

```ts
export function predictedLiters(distanceKm: number | null, ratePer100km: number): number | null
```

- `distanceKm == null` → `null`. Sinon `distanceKm * ratePer100km / 100`, arrondi à l'entier.

## 3. Interface

### Liste des départs (`DepartureList.tsx`)

Sous la ligne axe/bus/chauffeur, si `computeDistanceKm` renvoie une valeur :
`≈ 951 km · ≈ 285 L prévus` (texte discret, gris, sous les infos existantes). Rien n'est affiché
si la distance est inconnue (pas de `—` ni de `0 km` trompeur) — l'absence d'info reste silencieuse
plutôt que fausse.

Le calcul se fait côté client dans le composant à partir des `route_segments` et du réglage
`consumption_l_per_100km` chargés une fois par la page parente (`DeparturesScreen.tsx`), pas
recalculé par départ côté serveur.

### Écran Admin « Itinéraires »

Nouveau composant `src/components/admin/RoutesPanel.tsx`, ajouté à côté de `PricesPanel` /
`UsersPanel` dans la page Admin. Reprend le pattern de `PricesPanel` (formulaire d'ajout + liste,
réservé aux admins par la policy RLS) :

- Champs : Ville A, Ville B, Distance (km) → insert dans `route_segments`.
- Liste des tronçons existants, triée alphabétiquement, avec suppression (admin uniquement).
- Un champ séparé « Consommation prévisionnelle (L/100km) » qui lit/écrit
  `app_settings['consumption_l_per_100km']`.

### `FuelingForm.tsx` — photo du reçu

Ajout, sous le champ « Quantité (litres) », de deux boutons identiques au pattern de
`ScanForm.tsx` (« Prendre une photo » / « Ajouter une image », inputs file cachés,
`capture="environment"` pour l'appareil). Champ optionnel — le bouton « Enregistrer le plein »
reste actif sans photo.

À la soumission : si une photo est présente, upload vers le bucket `receipts`
(`{date}/{crypto.randomUUID()}.jpg`, même pattern que l'upload des photos de planning dans
`ScanForm.handleSave`), récupération de l'URL publique, ajoutée à l'insert `fuelings` comme
`receipt_photo_url`. Si l'upload échoue, le plein n'est pas enregistré et l'erreur s'affiche
(cohérent avec le traitement actuel des erreurs d'upload de planning) — pas d'enregistrement
partiel sans photo si l'utilisateur en a fourni une.

### Historique des reçus (`ReceiptsList.tsx`)

Si `fueling.receipt_photo_url` est renseigné, affichage d'un petit lien/miniature « Voir le
reçu » ouvrant la photo dans un nouvel onglet. Rien n'est affiché sinon.

## Gestion des erreurs

- Itinéraire avec un tronçon manquant → aucune distance affichée, aucune erreur bloquante (le
  planning s'enregistre normalement, c'est un affichage informatif en plus).
- Upload de la photo de reçu échoué → message d'erreur explicite, plein non enregistré (l'agent
  peut réessayer ou retirer la photo).
- Taux de consommation à 0 ou absent → aucune consommation prévisionnelle affichée (comme un
  tronçon manquant), pas de division par une valeur invalide.

## Tests

- `route.test.ts` : `parseRoute` (axe direct, axe avec ville de passage, axe avec suffixe
  `SPECIAL`/`REPOS`/`NUIT`, axe vide) ; `computeDistanceKm` (tronçon direct, chaîne de tronçons,
  tronçon manquant → `null`, tronçon trouvé dans le sens inverse `city_b, city_a`).
- `RoutesPanel.test.tsx` : ajout d'un tronçon, suppression, modification du taux de consommation
  (pattern `prices-panel.test.tsx`).
- `fueling.test.tsx` : ajout du cas « plein avec photo de reçu » (upload simulé, `receipt_photo_url`
  transmis à l'insert).
- `departures.test.tsx` : affichage de la distance/consommation prévisionnelle quand le tronçon
  existe, absence d'affichage quand il manque.

## Migration

Un seul fichier `supabase/migrations/0003_routes_settings_receipts.sql` : création de
`route_segments` (+ seed), `app_settings` (+ seed), `alter table fuelings add column
receipt_photo_url`, policies RLS, policies storage bucket `receipts`.
