# Liaison détaillée, calcul distance/consommation, reçu carburant photo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calculer automatiquement la distance et la consommation prévisionnelle de chaque départ à partir de son itinéraire (villes de passage comprises), et permettre d'attacher une photo du reçu de station à un plein de carburant.

**Architecture:** Un module pur `src/lib/planning/route.ts` (aucune dépendance réseau) découpe le texte d'axe déjà extrait par le scanner en liste de villes et calcule la distance en additionnant des tronçons stockés dans une nouvelle table `route_segments` (admin-éditable). Un taux de consommation global (`app_settings`) convertit la distance en litres prévisionnels. Ces deux réglages sont gérés depuis un nouvel écran Admin. Le formulaire de plein gagne une capture photo optionnelle, uploadée vers un nouveau bucket Storage `receipts`, suivant exactement le pattern déjà utilisé pour les photos de planning dans `ScanForm.tsx`.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS + Storage), Vitest + Testing Library.

## Global Constraints

- Aucune distance n'est jamais inventée à l'affichage : un itinéraire dont un tronçon est
  manquant en base n'affiche rien (pas de `—`, pas de `0 km`).
- Le tronçon `LOGA ↔ AGADEZ` n'est volontairement pas seedé (aucune source fiable) — laissé à
  saisir dans Admin > Itinéraires.
- La saisie des litres du plein reste manuelle ; la photo du reçu est un justificatif archivé,
  pas une source d'OCR.
- Toute nouvelle table suit le pattern RLS existant : lecture pour tout utilisateur
  authentifié, écriture réservée admin (voir `fuel_prices` / `is_admin()` dans
  `supabase/migrations/0001_init.sql` et `0002_fix_rls.sql`).
- Suivre le style de composant existant : formulaires `'use client'`, Tailwind utilitaire,
  composants `Button`/`Input`/`Select`/`Card` de `@/components/ui`, icônes de
  `@/components/ui/icons`.

---

### Task 1: Migration SQL + types partagés

**Files:**
- Create: `supabase/migrations/0003_routes_settings_receipts.sql`
- Modify: `src/lib/types.ts`
- Modify: `tests/departures.test.tsx` (2 littéraux `Fueling` à compléter)
- Modify: `tests/history.test.tsx` (2 littéraux `Fueling` à compléter)
- Modify: `DEPLOYMENT.md`

**Interfaces:**
- Produces: `RouteSegment { id, city_a, city_b, distance_km, created_by, created_at }` exporté
  de `src/lib/types.ts`, utilisé par les tasks 3, 4, 5, 6.
- Produces: `Fueling.receipt_photo_url: string | null`, utilisé par les tasks 7, 8.

- [ ] **Step 1: Écrire la migration SQL**

Créer `supabase/migrations/0003_routes_settings_receipts.sql` :

```sql
-- ============================================================
-- Itinéraires (distances), réglages applicatifs, photo de reçu carburant
-- ============================================================

create table public.route_segments (
  id uuid primary key default gen_random_uuid(),
  city_a text not null,
  city_b text not null,
  distance_km numeric not null check (distance_km > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (city_a, city_b)
);

create table public.app_settings (
  key text primary key,
  value text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.fuelings add column receipt_photo_url text;

-- Seed : distances routières (sources web concordantes, arrondies au km).
-- LOGA ↔ AGADEZ volontairement absent : aucune source fiable trouvée, à
-- renseigner manuellement dans Admin > Itinéraires dès que la route exacte
-- au nord de Loga est connue.
insert into public.route_segments (city_a, city_b, distance_km) values
  ('NIAMEY', 'AGADEZ', 951),
  ('NIAMEY', 'LOGA', 139),
  ('LOGA', 'DOSSO', 73),
  ('NIAMEY', 'DOSSO', 139),
  ('DOSSO', 'DOGONDOUTCHI', 139),
  ('DOGONDOUTCHI', 'KONNI', 147),
  ('KONNI', 'TAHOUA', 133),
  ('TAHOUA', 'AGADEZ', 398),
  ('AGADEZ', 'ARLIT', 240),
  ('NIAMEY', 'MARADI', 664),
  ('MARADI', 'ZINDER', 238),
  ('NIAMEY', 'ZINDER', 891),
  ('NIAMEY', 'GAYA', 287);

-- Seed : taux de consommation prévisionnelle global (L/100km), provisoire
-- (bus diesel type Yutong) — à ajuster dans Admin dès réception des specs réelles.
insert into public.app_settings (key, value) values
  ('consumption_l_per_100km', '30');

-- RLS : lecture pour tout utilisateur authentifié, écriture réservée admin
-- (même pattern que fuel_prices, voir 0001_init.sql).
alter table public.route_segments enable row level security;
alter table public.app_settings enable row level security;

create policy "route_segments_read_all" on public.route_segments
  for select using (auth.role() = 'authenticated');
create policy "route_segments_insert_admin" on public.route_segments
  for insert with check (public.is_admin());
create policy "route_segments_delete_admin" on public.route_segments
  for delete using (public.is_admin());

create policy "app_settings_read_all" on public.app_settings
  for select using (auth.role() = 'authenticated');
create policy "app_settings_insert_admin" on public.app_settings
  for insert with check (public.is_admin());
create policy "app_settings_update_admin" on public.app_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- Stockage : bucket "receipts" (à créer manuellement dans Supabase, public,
-- comme le bucket "plannings" — voir DEPLOYMENT.md).
create policy "receipts_storage_read" on storage.objects
  for select using (bucket_id = 'receipts');
create policy "receipts_storage_insert" on storage.objects
  for insert with check (bucket_id = 'receipts' and auth.role() = 'authenticated');
```

- [ ] **Step 2: Ajouter les types partagés**

Dans `src/lib/types.ts`, ajouter après l'interface `FuelPrice` :

```ts
export interface RouteSegment {
  id: string
  city_a: string
  city_b: string
  distance_km: number
  created_by: string | null
  created_at: string
}
```

Modifier l'interface `Fueling` existante pour ajouter le champ (juste après `paid_at`) :

```ts
export interface Fueling {
  id: string
  date: string
  departure_id: string | null
  bus_number: string
  driver_name: string
  fuel_type: FuelType
  liters: number
  unit_price: number
  amount: number
  paid: boolean
  paid_at: string | null
  receipt_photo_url: string | null
  recorded_by: string | null
  created_at: string
}
```

- [ ] **Step 3: Mettre à jour les littéraux `Fueling` existants dans les tests**

Dans `tests/departures.test.tsx`, les deux objets `Fueling` littéraux (lignes ~53-54) gagnent
`receipt_photo_url: null` juste avant `recorded_by: null` :

```ts
{ id: 'f1', date: '2026-08-06', departure_id: 'd1', bus_number: 'CG 6377', driver_name: 'YOUSSOUF', fuel_type: 'diesel', liters: 100, unit_price: 618, amount: 61800, paid: false, paid_at: null, receipt_photo_url: null, recorded_by: null, created_at: '' },
{ id: 'f2', date: '2026-08-06', departure_id: 'd1', bus_number: 'CG 6377', driver_name: 'YOUSSOUF', fuel_type: 'diesel', liters: 50, unit_price: 618, amount: 30900, paid: false, paid_at: null, receipt_photo_url: null, recorded_by: null, created_at: '' },
```

Dans `tests/history.test.tsx`, les deux objets `Fueling` littéraux (lignes ~13-14) gagnent le
même champ :

```ts
{ id: 'f1', date: '2026-08-06', departure_id: null, bus_number: 'CG 6377', driver_name: 'YOUSSOUF', fuel_type: 'diesel', liters: 300, unit_price: 618, amount: 185400, paid: false, paid_at: null, receipt_photo_url: null, recorded_by: null, created_at: '' },
{ id: 'f2', date: '2026-08-06', departure_id: null, bus_number: 'BH 8210', driver_name: 'MANSOUR', fuel_type: 'essence', liters: 200, unit_price: 499, amount: 99800, paid: true, paid_at: '2026-08-06T18:00:00Z', receipt_photo_url: null, recorded_by: null, created_at: '' },
```

- [ ] **Step 4: Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: `No errors found` (si une erreur mentionne un littéral `Fueling` oublié, le corriger
avec `receipt_photo_url: null` avant de continuer).

- [ ] **Step 5: Mettre à jour DEPLOYMENT.md**

Dans `DEPLOYMENT.md`, section `## 3. Base de données Supabase (production)`, remplacer :

```markdown
1. Exécuter `supabase/migrations/0001_init.sql` puis `0002_fix_rls.sql` dans le **SQL Editor**.
2. Créer un bucket de stockage public nommé `plannings`.
3. Créer le premier compte admin (Authentication → Users), puis passer son rôle à `admin`.
```

par :

```markdown
1. Exécuter `supabase/migrations/0001_init.sql`, `0002_fix_rls.sql` puis
   `0003_routes_settings_receipts.sql` dans le **SQL Editor**.
2. Créer deux buckets de stockage publics : `plannings` et `receipts`.
3. Créer le premier compte admin (Authentication → Users), puis passer son rôle à `admin`.
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0003_routes_settings_receipts.sql src/lib/types.ts tests/departures.test.tsx tests/history.test.tsx DEPLOYMENT.md
git commit -m "feat: tables itinéraires/réglages + colonne photo reçu carburant"
```

---

### Task 2: Module `route.ts` — parsing d'itinéraire et calcul de distance

**Files:**
- Create: `src/lib/planning/route.ts`
- Test: `tests/route.test.ts`

**Interfaces:**
- Consumes: rien (module pur, pas de dépendance à `parse.ts` ni à Supabase).
- Produces:
  - `normalizeCityName(s: string): string`
  - `parseRoute(axis: string): string[]`
  - `interface RouteSegmentInput { cityA: string; cityB: string; distanceKm: number }`
  - `computeDistanceKm(cities: string[], segments: RouteSegmentInput[]): number | null`
  - `predictedLiters(distanceKm: number | null, ratePer100km: number | null): number | null`
  - `parseConsumptionRate(value: string | null | undefined): number | null`

  Utilisés par les tasks 3 (`DepartureList`), 4 (`DeparturesScreen`/`queries.ts`) et 5
  (`RoutesPanel`).

- [ ] **Step 1: Écrire les tests (échouent d'abord)**

Créer `tests/route.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import {
  normalizeCityName,
  parseRoute,
  computeDistanceKm,
  predictedLiters,
  parseConsumptionRate,
  type RouteSegmentInput,
} from '@/lib/planning/route'

describe('normalizeCityName', () => {
  it('met en majuscules et compacte les espaces', () => {
    expect(normalizeCityName('  niamey   ')).toBe('NIAMEY')
    expect(normalizeCityName('Dosso  Doutchi')).toBe('DOSSO DOUTCHI')
  })
})

describe('parseRoute', () => {
  it('découpe un axe direct en deux villes', () => {
    expect(parseRoute('AGADEZ - NIAMEY')).toEqual(['AGADEZ', 'NIAMEY'])
  })
  it('découpe un axe avec une ville de passage', () => {
    expect(parseRoute('NIAMEY - LOGA - AGADEZ')).toEqual(['NIAMEY', 'LOGA', 'AGADEZ'])
  })
  it('retire le suffixe SPECIAL collé à la dernière ville', () => {
    expect(parseRoute('AGADEZ - NIAMEY SPECIAL')).toEqual(['AGADEZ', 'NIAMEY'])
  })
  it('retire NUIT même en position de ville', () => {
    expect(parseRoute('NUIT - GAYA')).toEqual(['GAYA'])
  })
  it('renvoie un tableau vide pour un axe vide', () => {
    expect(parseRoute('')).toEqual([])
  })
})

describe('computeDistanceKm', () => {
  const segments: RouteSegmentInput[] = [
    { cityA: 'NIAMEY', cityB: 'AGADEZ', distanceKm: 951 },
    { cityA: 'NIAMEY', cityB: 'LOGA', distanceKm: 139 },
  ]

  it('trouve un tronçon direct', () => {
    expect(computeDistanceKm(['NIAMEY', 'AGADEZ'], segments)).toBe(951)
  })
  it('trouve un tronçon stocké dans le sens inverse', () => {
    expect(computeDistanceKm(['AGADEZ', 'NIAMEY'], segments)).toBe(951)
  })
  it('additionne une chaîne de tronçons', () => {
    const withLogaAgadez = [...segments, { cityA: 'LOGA', cityB: 'AGADEZ', distanceKm: 850 }]
    expect(computeDistanceKm(['NIAMEY', 'LOGA', 'AGADEZ'], withLogaAgadez)).toBe(139 + 850)
  })
  it('renvoie null si un tronçon de la chaîne manque', () => {
    expect(computeDistanceKm(['NIAMEY', 'LOGA', 'AGADEZ'], segments)).toBeNull()
  })
  it('renvoie null pour moins de deux villes', () => {
    expect(computeDistanceKm(['GAYA'], segments)).toBeNull()
    expect(computeDistanceKm([], segments)).toBeNull()
  })
})

describe('predictedLiters', () => {
  it('calcule les litres prévus et arrondit', () => {
    expect(predictedLiters(951, 30)).toBe(285)
  })
  it('renvoie null si la distance est inconnue', () => {
    expect(predictedLiters(null, 30)).toBeNull()
  })
  it('renvoie null si le taux est absent ou invalide', () => {
    expect(predictedLiters(951, null)).toBeNull()
    expect(predictedLiters(951, 0)).toBeNull()
  })
})

describe('parseConsumptionRate', () => {
  it('parse une valeur texte valide', () => {
    expect(parseConsumptionRate('30')).toBe(30)
    expect(parseConsumptionRate('27.5')).toBe(27.5)
  })
  it('renvoie null pour une valeur absente ou invalide', () => {
    expect(parseConsumptionRate(null)).toBeNull()
    expect(parseConsumptionRate(undefined)).toBeNull()
    expect(parseConsumptionRate('abc')).toBeNull()
    expect(parseConsumptionRate('0')).toBeNull()
    expect(parseConsumptionRate('-5')).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run tests/route.test.ts`
Expected: FAIL — `Cannot find module '@/lib/planning/route'`

- [ ] **Step 3: Implémenter `route.ts`**

Créer `src/lib/planning/route.ts` :

```ts
const ROUTE_STOPWORDS = new Set(['SPECIAL', 'REPOS', 'NUIT'])

export function normalizeCityName(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ')
}

export function parseRoute(axis: string): string[] {
  return axis
    .split(' - ')
    .map((part) =>
      part
        .split(/\s+/)
        .filter((tok) => tok.length > 0 && !ROUTE_STOPWORDS.has(tok.toUpperCase()))
        .join(' ')
    )
    .map((part) => normalizeCityName(part))
    .filter((part) => part.length > 0)
}

export interface RouteSegmentInput {
  cityA: string
  cityB: string
  distanceKm: number
}

export function computeDistanceKm(cities: string[], segments: RouteSegmentInput[]): number | null {
  if (cities.length < 2) return null
  let total = 0
  for (let i = 0; i < cities.length - 1; i++) {
    const a = cities[i]
    const b = cities[i + 1]
    const seg = segments.find(
      (s) => (s.cityA === a && s.cityB === b) || (s.cityA === b && s.cityB === a)
    )
    if (!seg) return null
    total += seg.distanceKm
  }
  return total
}

export function predictedLiters(distanceKm: number | null, ratePer100km: number | null): number | null {
  if (distanceKm == null || ratePer100km == null || ratePer100km <= 0) return null
  return Math.round((distanceKm * ratePer100km) / 100)
}

export function parseConsumptionRate(value: string | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npx vitest run tests/route.test.ts`
Expected: PASS — tous les tests verts.

- [ ] **Step 5: Commit**

```bash
git add src/lib/planning/route.ts tests/route.test.ts
git commit -m "feat: parsing d'itinéraire et calcul distance/consommation prévisionnelle"
```

---

### Task 3: Affichage distance/consommation sur la liste des départs

**Files:**
- Modify: `src/components/departures/DepartureList.tsx`
- Modify: `tests/departures.test.tsx`

**Interfaces:**
- Consumes: `parseRoute`, `computeDistanceKm`, `predictedLiters` de `@/lib/planning/route`
  (Task 2) ; `RouteSegment` de `@/lib/types` (Task 1).
- Produces: `DepartureList` accepte deux nouvelles props optionnelles
  `segments?: RouteSegment[]` (défaut `[]`) et `consumptionRate?: number | null` (défaut
  `null`), consommées par la Task 4.

- [ ] **Step 1: Écrire le test (échoue d'abord)**

Dans `tests/departures.test.tsx`, ajouter en haut du fichier l'import du type :

```ts
import type { DepartureWithFuel, RouteSegment } from '@/lib/types'
```

(remplace l'import existant `import type { DepartureWithFuel } from '@/lib/types'`)

Ajouter un nouveau `describe` en fin de fichier :

```tsx
describe('DepartureList — distance et consommation prévisionnelle', () => {
  const segments: RouteSegment[] = [
    { id: 's1', city_a: 'NIAMEY', city_b: 'AGADEZ', distance_km: 951, created_by: null, created_at: '' },
  ]

  it('affiche la distance et la consommation prévues quand l’itinéraire est connu', () => {
    const rows = [departure({ id: '1', axis: 'NIAMEY - AGADEZ' })]
    render(<DepartureList departures={rows} segments={segments} consumptionRate={30} />)
    expect(screen.getByText(/≈ 951 km/)).toBeInTheDocument()
    expect(screen.getByText(/≈ 285 L prévus/)).toBeInTheDocument()
  })

  it('n’affiche rien quand un tronçon de l’itinéraire est inconnu', () => {
    const rows = [departure({ id: '1', axis: 'NIAMEY - LOGA - AGADEZ' })]
    render(<DepartureList departures={rows} segments={segments} consumptionRate={30} />)
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run tests/departures.test.tsx`
Expected: FAIL — le texte `≈ 951 km` n'est pas trouvé (la prop `segments` n'est pas encore
utilisée par le composant).

- [ ] **Step 3: Modifier `DepartureList.tsx`**

Remplacer le contenu de `src/components/departures/DepartureList.tsx` :

```tsx
import type { DepartureWithFuel, RouteSegment } from '@/lib/types'
import { originOf } from '@/lib/planning/parse'
import { parseRoute, computeDistanceKm, predictedLiters } from '@/lib/planning/route'
import { sumAmounts, formatFcfa } from '@/lib/fuel/calculations'
import { StatusBadge, type FuelingStatus } from './StatusBadge'

interface Props {
  departures: DepartureWithFuel[]
  onFuel?: (d: DepartureWithFuel) => void
  segments?: RouteSegment[]
  consumptionRate?: number | null
}

export function DepartureList({ departures, onFuel, segments = [], consumptionRate = null }: Props) {
  const groups = new Map<string, DepartureWithFuel[]>()
  for (const d of departures) {
    const city = originOf(d.axis)
    if (!groups.has(city)) groups.set(city, [])
    groups.get(city)!.push(d)
  }

  const segmentInputs = segments.map((s) => ({ cityA: s.city_a, cityB: s.city_b, distanceKm: s.distance_km }))

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([city, rows]) => (
        <section key={city}>
          <div className="mb-2 flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-blue-500" />
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{city}</h2>
            <span className="text-xs text-slate-400">· {rows.length} départ{rows.length > 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {rows.map((d) => {
              const total = sumAmounts(d.fuelings)
              const paid = d.fuelings.length > 0 && d.fuelings.every((f) => f.paid)
              const status: FuelingStatus = d.fuelings.length === 0 ? 'empty' : paid ? 'paid' : 'fueled'
              const distanceKm = computeDistanceKm(parseRoute(d.axis), segmentInputs)
              const liters = predictedLiters(distanceKm, consumptionRate)
              return (
                <button
                  key={d.id}
                  data-testid="departure-row"
                  onClick={() => onFuel?.(d)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                >
                  <span className="w-16 shrink-0 rounded-lg bg-slate-100 px-2 py-1.5 text-center text-xs font-bold text-slate-700">
                    {d.departure_time || '—'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{d.axis}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {d.bus_number} · {d.driver_name || '—'}
                    </span>
                    {distanceKm != null ? (
                      <span className="block text-xs text-slate-400">
                        ≈ {distanceKm} km{liters != null ? ` · ≈ ${liters} L prévus` : ''}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {d.fuelings.length > 0 ? (
                      <span className="tabular text-sm font-bold text-slate-900">{formatFcfa(total)}</span>
                    ) : null}
                    <StatusBadge status={status} />
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npx vitest run tests/departures.test.tsx`
Expected: PASS — tous les tests verts (y compris ceux déjà existants, qui n'utilisent pas les
nouvelles props et doivent continuer à fonctionner grâce aux valeurs par défaut).

- [ ] **Step 5: Commit**

```bash
git add src/components/departures/DepartureList.tsx tests/departures.test.tsx
git commit -m "feat: afficher distance et consommation prévisionnelle sur la liste des départs"
```

---

### Task 4: Chargement des tronçons/taux dans l'écran des départs

**Files:**
- Modify: `src/lib/supabase/queries.ts`
- Modify: `src/components/departures/DeparturesScreen.tsx`

**Interfaces:**
- Consumes: `RouteSegment` de `@/lib/types` (Task 1), `parseConsumptionRate` de
  `@/lib/planning/route` (Task 2), props `segments`/`consumptionRate` de `DepartureList`
  (Task 3).
- Produces: `fetchRouteSegments(supabase): Promise<RouteSegment[]>`,
  `fetchConsumptionRate(supabase): Promise<number | null>`, réutilisées par la Task 6
  (page Admin charge aussi `route_segments`/`app_settings`, mais via une requête serveur
  directe — voir Task 6).

- [ ] **Step 1: Ajouter les fonctions de requête**

Dans `src/lib/supabase/queries.ts`, ajouter en haut l'import du type et de l'helper :

```ts
import type { Departure, Fueling, FuelPrice, RouteSegment } from '@/lib/types'
import { parseConsumptionRate } from '@/lib/planning/route'
```

(remplace la ligne d'import de types existante)

Ajouter en fin de fichier :

```ts
export async function fetchRouteSegments(supabase: SupabaseClient): Promise<RouteSegment[]> {
  const { data } = await supabase.from('route_segments').select('*').order('city_a')
  return (data ?? []) as RouteSegment[]
}

export async function fetchConsumptionRate(supabase: SupabaseClient): Promise<number | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('*')
    .eq('key', 'consumption_l_per_100km')
    .maybeSingle()
  return parseConsumptionRate(data?.value ?? null)
}
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: `No errors found`

- [ ] **Step 3: Charger et transmettre les données dans `DeparturesScreen`**

Dans `src/components/departures/DeparturesScreen.tsx`, modifier l'import des requêtes :

```ts
import { fetchDeparturesForDate, fetchFuelingsForDate, fetchRouteSegments, fetchConsumptionRate } from '@/lib/supabase/queries'
```

Remplacer la ligne d'import de type existante (`import type { Departure, DepartureWithFuel,
Fueling } from '@/lib/types'`) par :

```ts
import type { Departure, DepartureWithFuel, Fueling, RouteSegment } from '@/lib/types'
```

Ajouter deux états, juste après `const [selected, setSelected] = useState<DepartureWithFuel | null>(null)` :

```ts
const [segments, setSegments] = useState<RouteSegment[]>([])
const [consumptionRate, setConsumptionRate] = useState<number | null>(null)
```

Ajouter un effet de chargement unique (au montage), après l'effet existant qui appelle `load(date)` :

```ts
useEffect(() => {
  // chargement des réglages : setState après await (faux positif de la règle)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  Promise.all([fetchRouteSegments(supabase), fetchConsumptionRate(supabase)]).then(([segs, rate]) => {
    setSegments(segs)
    setConsumptionRate(rate)
  })
}, [supabase])
```

Passer les nouvelles props à `DepartureList` :

```tsx
<DepartureList departures={departures} onFuel={(d) => setSelected(d)} segments={segments} consumptionRate={consumptionRate} />
```

- [ ] **Step 4: Vérifier le build**

Run: `npm run build`
Expected: `Compiled successfully` (pas d'écran de test dédié pour `DeparturesScreen` — cohérent
avec le reste du code, ce composant n'a pas de test aujourd'hui ; la logique de calcul est déjà
couverte par `route.test.ts` et l'affichage par `departures.test.tsx`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries.ts src/components/departures/DeparturesScreen.tsx
git commit -m "feat: charger les itinéraires et le taux de consommation dans l'écran des départs"
```

---

### Task 5: Écran Admin « Itinéraires »

**Files:**
- Create: `src/components/admin/RoutesPanel.tsx`
- Test: `tests/routes-panel.test.tsx`

**Interfaces:**
- Consumes: `RouteSegment` de `@/lib/types` (Task 1), `normalizeCityName` de
  `@/lib/planning/route` (Task 2).
- Produces: `RoutesPanel({ initialSegments: RouteSegment[]; initialConsumptionRate: number |
  null })`, monté par la Task 6.

- [ ] **Step 1: Écrire le test (échoue d'abord)**

Créer `tests/routes-panel.test.tsx` :

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RoutesPanel } from '@/components/admin/RoutesPanel'
import type { RouteSegment } from '@/lib/types'

const segments: RouteSegment[] = [
  { id: '1', city_a: 'NIAMEY', city_b: 'AGADEZ', distance_km: 951, created_by: null, created_at: '' },
]

const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockUpsert = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) =>
      table === 'route_segments'
        ? {
            insert: mockInsert,
            select: () => ({ order: () => Promise.resolve({ data: segments }) }),
            delete: () => ({ eq: mockEq }),
          }
        : { upsert: mockUpsert },
  }),
}))

describe('RoutesPanel', () => {
  it('affiche les tronçons existants', () => {
    render(<RoutesPanel initialSegments={segments} initialConsumptionRate={30} />)
    expect(screen.getByText(/NIAMEY ↔ AGADEZ/)).toBeInTheDocument()
    expect(screen.getByText('951 km')).toBeInTheDocument()
  })

  it('ajoute un nouveau tronçon', async () => {
    mockInsert.mockResolvedValue({ error: null })
    render(<RoutesPanel initialSegments={segments} initialConsumptionRate={30} />)
    fireEvent.change(screen.getByLabelText(/ville a/i), { target: { value: 'loga' } })
    fireEvent.change(screen.getByLabelText(/ville b/i), { target: { value: 'agadez' } })
    fireEvent.change(screen.getByLabelText(/distance/i), { target: { value: '850' } })
    fireEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    expect(mockInsert.mock.calls[0][0]).toMatchObject({ city_a: 'LOGA', city_b: 'AGADEZ', distance_km: 850 })
  })

  it('supprime un tronçon', async () => {
    mockEq.mockResolvedValue({ error: null })
    render(<RoutesPanel initialSegments={segments} initialConsumptionRate={30} />)
    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))
    await waitFor(() => expect(mockEq).toHaveBeenCalledWith('id', '1'))
  })

  it('enregistre le taux de consommation', async () => {
    mockUpsert.mockResolvedValue({ error: null })
    render(<RoutesPanel initialSegments={segments} initialConsumptionRate={30} />)
    fireEvent.change(screen.getByLabelText(/litres \/ 100 km/i), { target: { value: '32' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le taux/i }))
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith({ key: 'consumption_l_per_100km', value: '32' }))
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run tests/routes-panel.test.tsx`
Expected: FAIL — `Cannot find module '@/components/admin/RoutesPanel'`

- [ ] **Step 3: Implémenter `RoutesPanel.tsx`**

Créer `src/components/admin/RoutesPanel.tsx` :

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RouteSegment } from '@/lib/types'
import { normalizeCityName } from '@/lib/planning/route'
import { Button, Input, Card } from '@/components/ui'
import { AlertIcon, TrashIcon } from '@/components/ui/icons'

interface Props {
  initialSegments: RouteSegment[]
  initialConsumptionRate: number | null
}

export function RoutesPanel({ initialSegments, initialConsumptionRate }: Props) {
  const supabase = createClient()
  const [segments, setSegments] = useState<RouteSegment[]>(initialSegments)
  const [cityA, setCityA] = useState('')
  const [cityB, setCityB] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [rate, setRate] = useState(initialConsumptionRate ? String(initialConsumptionRate) : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const { data } = await supabase.from('route_segments').select('*').order('city_a')
    setSegments((data ?? []) as RouteSegment[])
  }

  async function handleAddSegment(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const d = Number(distanceKm)
    if (!cityA.trim() || !cityB.trim()) {
      setError('Saisissez les deux villes.')
      return
    }
    if (!d || d <= 0) {
      setError('Saisissez une distance valide.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('route_segments').insert({
      city_a: normalizeCityName(cityA),
      city_b: normalizeCityName(cityB),
      distance_km: d,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setCityA('')
    setCityB('')
    setDistanceKm('')
    await refresh()
  }

  async function handleDelete(id: string) {
    setBusy(true)
    const { error } = await supabase.from('route_segments').delete().eq('id', id)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    await refresh()
  }

  async function handleRateSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const r = Number(rate)
    if (!r || r <= 0) {
      setError('Saisissez un taux valide.')
      return
    }
    setBusy(true)
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'consumption_l_per_100km', value: String(r) })
    setBusy(false)
    if (error) {
      setError(error.message)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleRateSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold text-slate-900">Consommation prévisionnelle</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input id="rate" label="Litres / 100 km" type="number" min="0" step="0.5" value={rate} onChange={(e) => setRate(e.target.value)} />
          <div className="flex items-end sm:col-span-2">
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy ? '…' : 'Enregistrer le taux'}
            </Button>
          </div>
        </div>
      </form>

      <form onSubmit={handleAddSegment} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold text-slate-900">Ajouter un tronçon</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <Input id="cityA" label="Ville A" value={cityA} onChange={(e) => setCityA(e.target.value)} />
          <Input id="cityB" label="Ville B" value={cityB} onChange={(e) => setCityB(e.target.value)} />
          <Input id="distanceKm" label="Distance (km)" type="number" min="0" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? '…' : 'Ajouter'}
            </Button>
          </div>
        </div>
        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
            <AlertIcon size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}
      </form>

      <Card title="Tronçons enregistrés">
        <ul className="divide-y divide-slate-100 text-sm">
          {segments.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2.5">
              <span className="text-slate-700">{s.city_a} ↔ {s.city_b}</span>
              <span className="flex items-center gap-3">
                <span className="tabular font-bold text-slate-900">{s.distance_km} km</span>
                <button
                  type="button"
                  aria-label="Supprimer"
                  onClick={() => handleDelete(s.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <TrashIcon size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npx vitest run tests/routes-panel.test.tsx`
Expected: PASS — tous les tests verts.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/RoutesPanel.tsx tests/routes-panel.test.tsx
git commit -m "feat: écran Admin pour gérer les tronçons de route et le taux de consommation"
```

---

### Task 6: Intégration de `RoutesPanel` dans la page Admin

**Files:**
- Modify: `src/app/(app)/admin/page.tsx`

**Interfaces:**
- Consumes: `RoutesPanel` (Task 5), `RouteSegment` de `@/lib/types` (Task 1),
  `parseConsumptionRate` de `@/lib/planning/route` (Task 2).

- [ ] **Step 1: Charger les données et monter le panneau**

Remplacer le contenu de `src/app/(app)/admin/page.tsx` :

```tsx
import { createClient } from '@/lib/supabase/server'
import type { FuelPrice, Profile, RouteSegment } from '@/lib/types'
import { parseConsumptionRate } from '@/lib/planning/route'
import { DropletIcon, UsersIcon, BusIcon } from '@/components/ui/icons'
import { PricesPanel } from '@/components/admin/PricesPanel'
import { UsersPanel } from '@/components/admin/UsersPanel'
import { RoutesPanel } from '@/components/admin/RoutesPanel'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  if (profile?.role !== 'admin') {
    return <p className="text-sm text-red-600">Accès réservé à l&apos;administrateur.</p>
  }

  const [{ data: prices }, { data: profiles }, { data: segments }, { data: setting }] = await Promise.all([
    supabase.from('fuel_prices').select('*').order('effective_date'),
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('route_segments').select('*').order('city_a'),
    supabase.from('app_settings').select('*').eq('key', 'consumption_l_per_100km').maybeSingle(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Administration</h1>
        <p className="mt-1 text-sm text-slate-500">Prix du carburant, itinéraires et comptes utilisateurs.</p>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <DropletIcon size={18} className="text-blue-600" />
          Prix du carburant
        </h2>
        <PricesPanel initialPrices={(prices ?? []) as FuelPrice[]} />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <BusIcon size={18} className="text-blue-600" />
          Itinéraires
        </h2>
        <RoutesPanel
          initialSegments={(segments ?? []) as RouteSegment[]}
          initialConsumptionRate={parseConsumptionRate(setting?.value ?? null)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <UsersIcon size={18} className="text-blue-600" />
          Utilisateurs
        </h2>
        <UsersPanel initialProfiles={(profiles ?? []) as Profile[]} />
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier le build**

Run: `npm run build`
Expected: `Compiled successfully` (page serveur non testée unitairement — cohérent avec le
montage existant de `PricesPanel`/`UsersPanel`, déjà non testé à ce niveau).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/admin/page.tsx"
git commit -m "feat: monter l'écran Itinéraires dans la page Admin"
```

---

### Task 7: Photo du reçu de station dans le formulaire de plein

**Files:**
- Modify: `src/components/fuel/FuelingForm.tsx`
- Modify: `tests/fueling.test.tsx`

**Interfaces:**
- Consumes: `Fueling.receipt_photo_url` (Task 1).
- Produces: rien de consommé ailleurs — dernière brique du chantier côté saisie.

- [ ] **Step 1: Écrire le test (échoue d'abord)**

Dans `tests/fueling.test.tsx`, remplacer le mock existant pour ajouter `storage` :

```ts
const mockInsert = vi.fn()
const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) =>
      table === 'fuelings'
        ? { insert: mockInsert }
        : { select: () => ({ order: () => Promise.resolve({ data: prices }) }) },
    storage: {
      from: () => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }),
    },
  }),
}))
```

Ajouter un nouveau test dans le `describe('FuelingForm', ...)` :

```tsx
it('upload la photo du reçu et l’attache au plein enregistré', async () => {
  mockInsert.mockResolvedValue({ error: null })
  mockUpload.mockResolvedValue({ error: null })
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://ex.test/receipts/x.jpg' } })
  render(<FuelingForm departure={departure} onSaved={() => {}} />)
  await screen.findByText('618 FCFA')
  fireEvent.change(screen.getByLabelText(/litres/i), { target: { value: '300' } })
  const file = new File(['x'], 'recu.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByTestId('receipt-photo-input'), { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: /enregistrer le plein/i }))
  await waitFor(() => expect(mockInsert).toHaveBeenCalled())
  expect(mockUpload).toHaveBeenCalled()
  expect(mockInsert.mock.calls[0][0]).toMatchObject({ receipt_photo_url: 'https://ex.test/receipts/x.jpg' })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run tests/fueling.test.tsx`
Expected: FAIL — `Unable to find an element by: [data-testid="receipt-photo-input"]`

- [ ] **Step 3: Modifier `FuelingForm.tsx`**

Modifier les imports en tête de fichier :

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DepartureWithFuel, FuelPrice, FuelType } from '@/lib/types'
import { computeAmount, formatFcfa, latestPrice, sumAmounts, todayLocalISO } from '@/lib/fuel/calculations'
import { Button, Input, Select } from '@/components/ui'
import { CameraIcon, UploadIcon, DropletIcon, AlertIcon, BanknotesIcon } from '@/components/ui/icons'
```

Ajouter les refs et l'état de la photo, juste après la déclaration de `busy` :

```tsx
const [busy, setBusy] = useState(false)
const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null)
const cameraRef = useRef<HTMLInputElement>(null)
const galleryRef = useRef<HTMLInputElement>(null)
```

Remplacer la fonction `handleSubmit` :

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setError('')
  const l = Number(liters)
  if (!l || l <= 0) {
    setError('Saisissez une quantité en litres.')
    return
  }
  if (unitPrice <= 0) {
    setError('Aucun prix défini pour ce carburant. Réglez-le dans Admin.')
    return
  }
  setBusy(true)

  let receiptPhotoUrl: string | null = null
  if (receiptPhoto) {
    const path = `${today}/${crypto.randomUUID()}.jpg`
    const { error: upErr } = await supabase.storage.from('receipts').upload(path, receiptPhoto)
    if (upErr) {
      setError(`Upload du reçu impossible : ${upErr.message}`)
      setBusy(false)
      return
    }
    const { data: pub } = supabase.storage.from('receipts').getPublicUrl(path)
    receiptPhotoUrl = pub.publicUrl
  }

  const { error } = await supabase.from('fuelings').insert({
    date: today,
    departure_id: departure.id,
    bus_number: departure.bus_number,
    driver_name: departure.driver_name,
    fuel_type: type,
    liters: l,
    unit_price: unitPrice,
    amount,
    ...(receiptPhotoUrl ? { receipt_photo_url: receiptPhotoUrl } : {}),
  })
  setBusy(false)
  if (error) {
    setError(error.message)
    return
  }
  onSaved()
}
```

Ajouter le bloc de capture photo dans le JSX, juste avant le bloc `{error ? (...) : null}` final
(donc après le bloc « Total du départ ») :

```tsx
<div>
  <p className="mb-2 text-sm font-semibold text-slate-700">Photo du reçu (optionnel)</p>
  <div className="grid grid-cols-2 gap-2">
    <button
      type="button"
      onClick={() => cameraRef.current?.click()}
      className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50/40"
    >
      <CameraIcon size={16} />
      Photo
    </button>
    <button
      type="button"
      onClick={() => galleryRef.current?.click()}
      className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50/40"
    >
      <UploadIcon size={16} />
      Galerie
    </button>
  </div>
  {receiptPhoto ? <p className="mt-2 text-xs text-slate-500">{receiptPhoto.name}</p> : null}
  <input
    ref={cameraRef}
    type="file"
    accept="image/*"
    capture="environment"
    onChange={(e) => setReceiptPhoto(e.target.files?.[0] ?? null)}
    className="hidden"
  />
  <input
    ref={galleryRef}
    data-testid="receipt-photo-input"
    type="file"
    accept="image/*"
    onChange={(e) => setReceiptPhoto(e.target.files?.[0] ?? null)}
    className="hidden"
  />
</div>
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npx vitest run tests/fueling.test.tsx`
Expected: PASS — tous les tests verts, y compris les tests existants (le plein sans photo
n'envoie toujours pas de `receipt_photo_url`, ce qui reste compatible avec `toMatchObject`).

- [ ] **Step 5: Commit**

```bash
git add src/components/fuel/FuelingForm.tsx tests/fueling.test.tsx
git commit -m "feat: capturer et archiver la photo du reçu de station lors d'un plein"
```

---

### Task 8: Lien vers la photo du reçu dans l'historique

**Files:**
- Modify: `src/components/history/ReceiptsList.tsx`
- Modify: `tests/history.test.tsx`

**Interfaces:**
- Consumes: `Fueling.receipt_photo_url` (Task 1, déjà présent sur les fixtures de test depuis
  la Task 1).

- [ ] **Step 1: Écrire le test (échoue d'abord)**

Dans `tests/history.test.tsx`, modifier le premier fueling de test (`f1`) pour lui donner une
photo de reçu :

```ts
{ id: 'f1', date: '2026-08-06', departure_id: null, bus_number: 'CG 6377', driver_name: 'YOUSSOUF', fuel_type: 'diesel', liters: 300, unit_price: 618, amount: 185400, paid: false, paid_at: null, receipt_photo_url: 'https://ex.test/receipts/f1.jpg', recorded_by: null, created_at: '' },
```

Ajouter un test dans `describe('ReceiptsList', ...)` :

```tsx
it('affiche un lien vers la photo du reçu quand elle existe', () => {
  render(<ReceiptsList fuelings={fuelings} />)
  const link = screen.getByRole('link', { name: /voir le reçu/i })
  expect(link).toHaveAttribute('href', 'https://ex.test/receipts/f1.jpg')
  // f2 n'a pas de photo : un seul lien affiché
  expect(screen.getAllByRole('link', { name: /voir le reçu/i })).toHaveLength(1)
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run tests/history.test.tsx`
Expected: FAIL — aucun élément avec le rôle `link` nommé « Voir le reçu ».

- [ ] **Step 3: Modifier `ReceiptsList.tsx`**

Dans `src/components/history/ReceiptsList.tsx`, remplacer le bloc :

```tsx
<div className="mt-0.5 text-xs text-slate-500">
  {f.date} · {f.liters} L
</div>
```

par :

```tsx
<div className="mt-0.5 text-xs text-slate-500">
  {f.date} · {f.liters} L
  {f.receipt_photo_url ? (
    <>
      {' · '}
      <a href={f.receipt_photo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
        Voir le reçu
      </a>
    </>
  ) : null}
</div>
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npx vitest run tests/history.test.tsx`
Expected: PASS — tous les tests verts.

- [ ] **Step 5: Vérification finale du projet**

Run: `npm test && npx tsc --noEmit && npm run build && npm run lint`
Expected: tests verts, `No errors found`, `Compiled successfully`, `No issues found`.

- [ ] **Step 6: Commit**

```bash
git add src/components/history/ReceiptsList.tsx tests/history.test.tsx
git commit -m "feat: afficher le lien vers la photo du reçu dans l'historique des pleins"
```
