# Système de gestion du service d'achat — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Application web (Next.js + Supabase) pour le service d'achat d'une entreprise de transport au Niger : scanner les plannings de départs (OCR gratuit dans le navigateur), suivre les pleins de carburant des bus avant départ, calculer automatiquement montants et grand total, et gérer les utilisateurs.

**Architecture:** Next.js App Router déployé sur Vercel, Supabase (Postgres + Auth + Storage), OCR Tesseract.js exécuté 100 % côté navigateur. Le parseur de tableau OCR et les calculs carburant sont des fonctions pures testées par unit tests. L'UI est responsive (sidebar desktop / bottom-nav mobile), en français.

**Tech Stack:** Next.js (App Router, TypeScript, Tailwind), @supabase/ssr + @supabase/supabase-js, tesseract.js, Vitest + @testing-library/react + jsdom.

## Global Constraints

- Langue de l'UI : **français** (libellés explicites, FCFA).
- Monnaie : **francs CFA (FCFA)** entiers.
- Carburant : deux types, `essence` et `diesel` ; prix actuels gérés par l'admin (avec historique).
- Le prix du litre est **copié sur le reçu** au moment de la saisie (jamais recalculé ensuite).
- Grand total = somme des `amount` des reçus de la date.
- Rôles : `admin` (tout) et `achat` (reçus seulement, pas les prix ni les utilisateurs).
- Moteur OCR : **Tesseract.js, côté navigateur, gratuit**. Aucune clé API OCR.
- Respecter le format des feuilles : heure en texte (ex. « 05 H 00 », « NUIT »), « NEANT » → champ vide.
- TDD : chaque tâche commence par un test qui échoue, puis l'implémentation minimale, puis le test qui passe, puis un commit.
- Convention de commit : messages conventional-commit, **jamais** de mention « Co-Authored-By: Claude » ni de la ligne « Generated with Claude Code ».
- Build local sans accès Supabase : créer `.env.local` avec des valeurs factices (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Les pages qui lisent les cookies sont dynamiques et ne sont pas exécutées au build.

---

### Task 1: Scaffold du projet Next.js + setup de test

**Files:**
- Create: (généré par create-next-app) — config racine, `src/`, etc.
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `tests/smoke.test.ts`
- Modify: `package.json` (scripts test)
- Create: `.env.local.example`

**Interfaces:**
- Produces: projet Next.js fonctionnel (`npm run dev` / `npm run build`), commande `npm test` exécutable, alias `@/*` → `src/*`.

- [ ] **Step 1: Scaffolder l'application Next.js**

Depuis la racine du projet (répertoire déjà initialisé en git par la spec) :

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Si create-next-app refuse le répertoire non vide (dossier `docs/`), répondre « yes » à l'écrasement s'il le propose, sinon déplacer temporairement `docs/` puis le remettre après le scaffold.

- [ ] **Step 2: Vérifier que le projet se lance**

```bash
npm run build
```

Expected: build OK (le site par défaut compile).

- [ ] **Step 3: Installer les dépendances de test**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 4: Créer la config Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Écrire le test fumée (qui échoue d'abord par absence d'outillage)**

Create `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

export function add(a: number, b: number): number {
  return a + b
}

describe('smoke', () => {
  it('adds', () => {
    expect(add(1, 2)).toBe(3)
  })
})
```

- [ ] **Step 6: Ajouter les scripts de test dans `package.json`**

Modify `package.json` scripts :

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Lancer le test et vérifier qu'il passe**

```bash
npm test
```

Expected: `smoke > adds` PASS.

- [ ] **Step 8: Créer le fichier de variables d'environnement**

Create `.env.local.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js + vitest setup"
```

---

### Task 2: Schéma Supabase (migration SQL) + types TypeScript

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `src/lib/types.ts`

**Interfaces:**
- Produces: migration SQL à exécuter dans Supabase (SQL Editor), types TS `Role`, `FuelType`, `Profile`, `Planning`, `Departure`, `FuelPrice`, `Fueling`, `DepartureWithFuel` importables via `@/lib/types`.

- [ ] **Step 1: Écrire la migration (testé par exécution sur Supabase)**

Create `supabase/migrations/0001_init.sql`:

```sql
-- Enums
create type user_role as enum ('admin', 'achat');
create type fuel_type as enum ('essence', 'diesel');

-- Profils utilisateurs (1-1 avec auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role user_role not null default 'achat',
  created_at timestamptz not null default now()
);

-- Plannings de départs (une date + photos scannées)
create table public.plannings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  source_label text not null default '',
  image_urls text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Départs (lignes d'un planning)
create table public.departures (
  id uuid primary key default gen_random_uuid(),
  planning_id uuid not null references public.plannings(id) on delete cascade,
  axis text not null,
  bus_number text not null default '',
  departure_time text not null default '',
  driver_name text not null default '',
  driver_phone text not null default '',
  backup_driver text,
  backup_phone text
);

-- Historique des prix carburant
create table public.fuel_prices (
  id uuid primary key default gen_random_uuid(),
  fuel_type fuel_type not null,
  price integer not null check (price >= 0),
  effective_date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Reçus de plein
create table public.fuelings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  departure_id uuid references public.departures(id) on delete set null,
  bus_number text not null,
  driver_name text not null default '',
  fuel_type fuel_type not null,
  liters numeric not null check (liters >= 0),
  unit_price integer not null check (unit_price >= 0),
  amount numeric not null check (amount >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_departures_planning on public.departures(planning_id);
create index if not exists idx_plannings_date on public.plannings(date);
create index if not exists idx_fuelings_date on public.fuelings(date);

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'achat');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.plannings enable row level security;
alter table public.departures enable row level security;
alter table public.fuel_prices enable row level security;
alter table public.fuelings enable row level security;

create policy "profiles_read_all" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_admin" on public.profiles
  for update using (auth.uid() in (select id from public.profiles where role = 'admin'));

create policy "plannings_read_all" on public.plannings
  for select using (auth.role() = 'authenticated');
create policy "plannings_insert_admin" on public.plannings
  for insert with check (auth.uid() in (select id from public.profiles where role = 'admin'));
create policy "plannings_delete_admin" on public.plannings
  for delete using (auth.uid() in (select id from public.profiles where role = 'admin'));

create policy "departures_read_all" on public.departures
  for select using (auth.role() = 'authenticated');
create policy "departures_insert_admin" on public.departures
  for insert with check (auth.uid() in (select id from public.profiles where role = 'admin'));
create policy "departures_delete_admin" on public.departures
  for delete using (auth.uid() in (select id from public.profiles where role = 'admin'));

create policy "fuel_prices_read_all" on public.fuel_prices
  for select using (auth.role() = 'authenticated');
create policy "fuel_prices_insert_admin" on public.fuel_prices
  for insert with check (auth.uid() in (select id from public.profiles where role = 'admin'));

create policy "fuelings_read_all" on public.fuelings
  for select using (auth.role() = 'authenticated');
create policy "fuelings_insert_agents" on public.fuelings
  for insert with check (auth.uid() in (select id from public.profiles where role in ('admin','achat')));
create policy "fuelings_update_agents" on public.fuelings
  for update using (auth.uid() in (select id from public.profiles where role in ('admin','achat')));
```

- [ ] **Step 2: Écrire les types TypeScript**

Create `src/lib/types.ts`:

```ts
export type Role = 'admin' | 'achat'
export type FuelType = 'essence' | 'diesel'

export interface Profile {
  id: string
  full_name: string
  role: Role
  created_at: string
}

export interface Planning {
  id: string
  date: string
  source_label: string
  image_urls: string[]
  created_by: string | null
  created_at: string
}

export interface Departure {
  id: string
  planning_id: string
  axis: string
  bus_number: string
  departure_time: string
  driver_name: string
  driver_phone: string
  backup_driver: string | null
  backup_phone: string | null
}

export interface FuelPrice {
  id: string
  fuel_type: FuelType
  price: number
  effective_date: string
  created_by: string | null
  created_at: string
}

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
  recorded_by: string | null
  created_at: string
}

export interface DepartureWithFuel extends Departure {
  fuelings: Fueling[]
}
```

- [ ] **Step 3: Vérifier le typage**

```bash
npx tsc --noEmit
```

Expected: PAS d'erreur de type (le projet par défaut compile).

- [ ] **Step 4: Documenter l'application de la migration**

Create `supabase/migrations/README.md`:

```md
# Migrations Supabase

Pour appliquer : ouvrir le SQL Editor de Supabase (Table Editor > SQL),
coller le contenu de `0001_init.sql` et exécuter.

Créer ensuite un bucket de stockage nommé `plannings`, en mode **public**,
pour conserver les photos des plannings.
```

- [ ] **Step 5: Commit**

```bash
git add supabase src/lib/types.ts && git commit -m "feat: schéma supabase et types"
```

---

### Task 3: Lib calculs carburant (fonctions pures)

**Files:**
- Create: `src/lib/fuel/calculations.ts`
- Test: `tests/fuel-calculations.test.ts`

**Interfaces:**
- Consumes: `FuelPrice`, `Fueling` from `@/lib/types`.
- Produces: `computeAmount(liters: number, unitPrice: number): number`, `sumAmounts(fuelings: { amount: number }[]): number`, `formatFcfa(amount: number): string`, `latestPrice(prices: FuelPrice[], type: FuelType, onDate: string): number | null`, `todayLocalISO(): string`.

- [ ] **Step 1: Écrire le test qui échoue**

Create `tests/fuel-calculations.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeAmount, sumAmounts, formatFcfa, latestPrice, todayLocalISO } from '@/lib/fuel/calculations'
import type { FuelPrice } from '@/lib/types'

describe('computeAmount', () => {
  it('calcule litres × prix (arrondi entier FCFA)', () => {
    expect(computeAmount(300, 618)).toBe(185400)
    expect(computeAmount(300.5, 618)).toBe(185709) // 300.5 × 618 = 185709
    expect(computeAmount(0, 618)).toBe(0)
  })
})

describe('sumAmounts', () => {
  it('additionne les montants des reçus', () => {
    expect(sumAmounts([{ amount: 1000 }, { amount: 250 }, { amount: 40 }])).toBe(1290)
    expect(sumAmounts([])).toBe(0)
  })
})

describe('formatFcfa', () => {
  it('formate en FCFA avec séparateurs français', () => {
    expect(formatFcfa(185400)).toBe('185 400 FCFA')
    expect(formatFcfa(0)).toBe('0 FCFA')
  })
})

describe('latestPrice', () => {
  const prices: FuelPrice[] = [
    { id: '1', fuel_type: 'diesel', price: 600, effective_date: '2026-01-01', created_by: null, created_at: '' },
    { id: '2', fuel_type: 'diesel', price: 618, effective_date: '2026-07-01', created_by: null, created_at: '' },
    { id: '3', fuel_type: 'essence', price: 499, effective_date: '2026-07-01', created_by: null, created_at: '' },
  ]
  it('renvoie le dernier prix applicable avant la date', () => {
    expect(latestPrice(prices, 'diesel', '2026-07-15')).toBe(618)
    expect(latestPrice(prices, 'diesel', '2026-06-30')).toBe(600)
  })
  it('ignore les prix futurs', () => {
    expect(latestPrice(prices, 'diesel', '2026-01-01')).toBe(600)
  })
  it('renvoie null si aucun prix', () => {
    expect(latestPrice([], 'essence', '2026-01-01')).toBeNull()
  })
})

describe('todayLocalISO', () => {
  it('renvoie la date locale au format ISO (jj/mm/aaaa, pas UTC)', () => {
    expect(todayLocalISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

```bash
npx vitest run tests/fuel-calculations.test.ts
```

Expected: FAIL — module `@/lib/fuel/calculations` introuvable.

- [ ] **Step 3: Implémenter la lib**

Create `src/lib/fuel/calculations.ts`:

```ts
import type { FuelPrice, FuelType } from '@/lib/types'

export function computeAmount(liters: number, unitPrice: number): number {
  return Math.round(liters * unitPrice)
}

export function sumAmounts(fuelings: { amount: number }[]): number {
  return fuelings.reduce((sum, f) => sum + f.amount, 0)
}

export function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`
}

export function latestPrice(prices: FuelPrice[], type: FuelType, onDate: string): number | null {
  const candidates = prices.filter(
    (p) => p.fuel_type === type && p.effective_date <= onDate
  )
  if (candidates.length === 0) return null
  const best = candidates.reduce((a, b) =>
    a.effective_date > b.effective_date ? a : b
  )
  return best.price
}

export function todayLocalISO(): string {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run tests/fuel-calculations.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fuel tests/fuel-calculations.test.ts && git commit -m "feat: calculs carburant (montant, totaux, prix courant)"
```

---

### Task 4: Parseur OCR du planning (fonction pure)

**Files:**
- Create: `src/lib/planning/parse.ts`
- Test: `tests/planning-parse.test.ts`

**Interfaces:**
- Consumes: rien (types autonomes `OcrToken`, `OcrLine`).
- Produces:
  - `interface OcrToken { text: string; x0: number; y0: number; x1: number; y1: number }`
  - `interface OcrLine { tokens: OcrToken[]; y: number }`
  - `interface ParsedDeparture { axis: string; busNumber: string; departureTime: string; driverName: string; driverPhone: string; backupDriver: string; backupPhone: string }`
  - `interface ParsedSection { originCity: string; departures: ParsedDeparture[] }`
  - `interface ParsedPlanning { date: string | null; sections: ParsedSection[] }`
  - `parsePlanning(lines: OcrLine[]): ParsedPlanning`
  - `parseDateFromLines(lines: OcrLine[]): string | null`
  - `detectSectionHeader(line: OcrLine): string | null`
  - `classifyRow(line: OcrLine): ParsedDeparture | null`
  - `originOf(axis: string): string`

- [ ] **Step 1: Écrire le test qui échoue**

Create `tests/planning-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parsePlanning, parseDateFromLines, detectSectionHeader, classifyRow, originOf } from '@/lib/planning/parse'
import type { OcrLine, OcrToken } from '@/lib/planning/parse'

// Helper : construit une ligne depuis des mots espacés sur la même ligne Y
function line(xBase: number, y: number, words: [string, number][]): OcrLine {
  const tokens: OcrToken[] = []
  let x = xBase
  for (const [text, w] of words) {
    tokens.push({ text, x0: x, y0: y, x1: x + w, y1: y + 20 })
    x += w + 4
  }
  return { tokens, y: y + 10 }
}

function w(text: string): [string, number] {
  return [text, text.length * 9]
}

describe('parseDateFromLines', () => {
  it('extrait une date au format jj/mm/aaaa', () => {
    const lines = [line(0, 0, [w('PLANNING'), w('DU'), w('VOYAGE'), w('DEPART'), w('NIAMEY'), w('06/08/2026')])]
    expect(parseDateFromLines(lines)).toBe('2026-08-06')
  })
  it('renvoie null sans date', () => {
    expect(parseDateFromLines([line(0, 0, [w('AGADEZ')])])).toBeNull()
  })
})

describe('detectSectionHeader', () => {
  it('reconnaît DEPART AGADEZ', () => {
    expect(detectSectionHeader(line(0, 0, [w('DEPART'), w('AGADEZ')]))).toBe('AGADEZ')
  })
  it('reconnaît PLANNING DU VOYAGE DEPART NIAMEY', () => {
    const l = line(0, 0, [w('PLANNING'), w('DU'), w('VOYAGE'), w('DEPART'), w('NIAMEY')])
    expect(detectSectionHeader(l)).toBe('NIAMEY')
  })
  it('ne reconnaît pas une ligne de données', () => {
    expect(detectSectionHeader(line(0, 0, [w('AGADEZ'), w('-'), w('NIAMEY')]))).toBeNull()
  })
})

describe('classifyRow', () => {
  it('reconnaît une ligne classique AGADEZ - NIAMEY', () => {
    const l = line(0, 0, [
      w('AGADEZ'), w('-'), w('NIAMEY'), w('SPECIAL'),
      w('CG'), w('6377'),
      w('05'), w('H'), w('00'),
      w('YOUSSOUF'),
      w('96474717'),
    ])
    const row = classifyRow(l)
    expect(row).not.toBeNull()
    expect(row!.axis).toBe('AGADEZ - NIAMEY SPECIAL')
    expect(row!.busNumber).toBe('CG 6377')
    expect(row!.departureTime).toBe('05 H 00')
    expect(row!.driverName).toBe('YOUSSOUF')
    expect(row!.driverPhone).toBe('96474717')
  })

  it('gère une heure NUIT et un axe en une seule plage', () => {
    const l = line(0, 0, [
      w('NUIT'), w('-'), w('GAYA'),
      w('BH'), w('8210'),
      w('NUIT'),
      w('MANSOUR'),
      w('96856627'),
    ])
    const row = classifyRow(l)
    expect(row).not.toBeNull()
    expect(row!.axis).toBe('NUIT - GAYA')
    expect(row!.busNumber).toBe('BH 8210')
    expect(row!.departureTime).toBe('NUIT')
    expect(row!.driverName).toBe('MANSOUR')
  })

  it('ignore la ligne d’en-tête du tableau', () => {
    const l = line(0, 0, [w('Axes'), w('N°'), w('Bus'), w('Heure'), w('Chauffeur')])
    expect(classifyRow(l)).toBeNull()
  })
})

describe('originOf', () => {
  it('extrait la ville d’origine de l’axe', () => {
    expect(originOf('AGADEZ - NIAMEY SPECIAL')).toBe('AGADEZ')
    expect(originOf('ZINDER - LOGA - NIAMEY')).toBe('ZINDER')
    expect(originOf('INGAL - AGADEZ')).toBe('INGAL')
  })
})

describe('parsePlanning', () => {
  it('découpe les sections et rassemble les départs', () => {
    const lines = [
      line(0, 0, [w('DEPART'), w('AGADEZ')]),
      line(0, 100, [w('AGADEZ'), w('-'), w('NIAMEY'), w('CG'), w('6377'), w('05'), w('H'), w('00'), w('YOUSSOUF'), w('96474717')]),
      line(0, 200, [w('DEPART'), w('ARLIT')]),
      line(0, 300, [w('ARLIT'), w('-'), w('AGADEZ'), w('BM'), w('5852'), w('05'), w('H'), w('00'), w('BOUBACAR'), w('97065041')]),
    ]
    const parsed = parsePlanning(lines)
    expect(parsed.sections).toHaveLength(2)
    expect(parsed.sections[0].originCity).toBe('AGADEZ')
    expect(parsed.sections[0].departures).toHaveLength(1)
    expect(parsed.sections[1].departures[0].busNumber).toBe('BM 5852')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

```bash
npx vitest run tests/planning-parse.test.ts
```

Expected: FAIL — module `@/lib/planning/parse` introuvable.

- [ ] **Step 3: Implémenter le parseur**

Create `src/lib/planning/parse.ts`:

```ts
export interface OcrToken {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface OcrLine {
  tokens: OcrToken[]
  y: number
}

export interface ParsedDeparture {
  axis: string
  busNumber: string
  departureTime: string
  driverName: string
  driverPhone: string
  backupDriver: string
  backupPhone: string
}

export interface ParsedSection {
  originCity: string
  departures: ParsedDeparture[]
}

export interface ParsedPlanning {
  date: string | null
  sections: ParsedSection[]
}

const PHONE_RE = /^\d{7,8}$/
const BUS_TOKEN_RE = /^[A-Z]{2}\s?\d{3,4}$/
const LETTERS_RE = /^[A-Z]{1,2}$/
const DIGITS3_RE = /^\d{3,4}$/
const TIME_PART_RE = /^(\d{1,2}|H|H\d{2}|\d{1,2}H\d{2}|\d{1,2}H|NUIT)$/i
const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/
const HEADER_SKIP_RE = /^(axe|axes|n°|num|heure|chauffeur|tel|télé|depart)/i

export function lineText(line: OcrLine): string {
  return line.tokens.map((t) => t.text).join(' ').trim()
}

export function parseDateFromLines(lines: OcrLine[]): string | null {
  for (const line of lines) {
    for (const token of line.tokens) {
      const m = token.text.match(DATE_RE)
      if (m) {
        const [, dd, mm, yyyy] = m
        return `${yyyy}-${mm}-${dd}`
      }
    }
  }
  return null
}

export function detectSectionHeader(line: OcrLine): string | null {
  const text = lineText(line)
  const m = text.match(/(?:^|\s)DEPART\s+([A-ZÀ-Ü]+)/i)
  if (!m) return null
  return m[1].toUpperCase()
}

export function originOf(axis: string): string {
  const first = axis.split(' - ')[0].trim()
  return first.toUpperCase() || 'Autre'
}

function findBus(tokens: OcrToken[]): { bus: string; start: number; end: number } | null {
  for (let i = 0; i < tokens.length; i++) {
    if (BUS_TOKEN_RE.test(tokens[i].text)) {
      return { bus: tokens[i].text.trim(), start: i, end: i + 1 }
    }
    if (
      LETTERS_RE.test(tokens[i].text) &&
      i + 1 < tokens.length &&
      DIGITS3_RE.test(tokens[i + 1].text) &&
      tokens[i + 1].x0 - tokens[i].x1 < 15
    ) {
      return { bus: `${tokens[i].text} ${tokens[i + 1].text}`, start: i, end: i + 2 }
    }
  }
  return null
}

export function classifyRow(line: OcrLine): ParsedDeparture | null {
  const tokens = [...line.tokens].sort((a, b) => a.x0 - b.x0)
  const joined = lineText({ tokens, y: line.y })
  if (HEADER_SKIP_RE.test(joined.trim())) return null

  const bus = findBus(tokens)
  if (!bus) return null

  const axisTokens = tokens.slice(0, bus.start)
  const axis = axisTokens.map((t) => t.text).join(' ').trim()

  const timeParts: string[] = []
  let i = bus.end
  while (i < tokens.length && TIME_PART_RE.test(tokens[i].text)) {
    timeParts.push(tokens[i].text)
    i++
  }
  const departureTime = timeParts.join(' ')

  const phones = tokens.filter((t) => PHONE_RE.test(t.text)).map((t) => t.text)
  const driverTokens = tokens.slice(i).filter((t) => !PHONE_RE.test(t.text))
  const driverName = driverTokens.map((t) => t.text).join(' ').trim()

  return {
    axis,
    busNumber: bus.bus,
    departureTime,
    driverName,
    driverPhone: phones[0] ?? '',
    backupDriver: '',
    backupPhone: phones[1] ?? '',
  }
}

export function parsePlanning(lines: OcrLine[]): ParsedPlanning {
  const date = parseDateFromLines(lines)
  const sections: ParsedSection[] = []
  let current: ParsedSection | null = null

  const sorted = [...lines].sort((a, b) => a.y - b.y)
  for (const line of sorted) {
    const header = detectSectionHeader(line)
    if (header) {
      current = { originCity: header, departures: [] }
      sections.push(current)
      continue
    }
    const row = classifyRow(line)
    if (row) {
      if (!current) {
        current = { originCity: originOf(row.axis), departures: [] }
        sections.push(current)
      }
      current.departures.push(row)
    }
  }
  return { date, sections }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run tests/planning-parse.test.ts
```

Expected: tous les tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/planning tests/planning-parse.test.ts && git commit -m "feat: parseur OCR du planning"
```

---

### Task 5: Module OCR (Tesseract.js) — aplatissement + exécution

**Files:**
- Create: `src/lib/planning/ocr.ts`
- Test: `tests/ocr-flatten.test.ts`

**Interfaces:**
- Consumes: `OcrLine`, `OcrToken` from `@/lib/planning/parse`.
- Produces: `linesFromTessData(data: unknown): OcrLine[]` (pur, testé) et `runOcr(image: File | Blob): Promise<OcrLine[]>` (wrapper navigateur).

- [ ] **Step 1: Installer Tesseract.js**

```bash
npm install tesseract.js
```

- [ ] **Step 2: Écrire le test qui échoue**

Create `tests/ocr-flatten.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { linesFromTessData } from '@/lib/planning/ocr'

// Simule la structure data de tesseract.js (blocks > paragraphs > lines > words)
function tessWord(text: string, x0: number, y0: number): unknown {
  return { text, bbox: { x0, y0, x1: x0 + text.length * 9, y1: y0 + 20 } }
}

describe('linesFromTessData', () => {
  it('aplatit les blocs/paragraphes/lignes en OcrLine triées par Y', () => {
    const data = {
      blocks: [
        {
          paragraphs: [
            {
              lines: [
                { words: [tessWord('DEPART', 0, 0), tessWord('AGADEZ', 60, 0)] },
                { words: [tessWord('AGADEZ', 0, 100), tessWord('-', 70, 100), tessWord('NIAMEY', 80, 100)] },
              ],
            },
          ],
        },
      ],
    }
    const lines = linesFromTessData(data)
    expect(lines).toHaveLength(2)
    expect(lines[0].y).toBeLessThan(lines[1].y)
    expect(lines[0].tokens.map((t) => t.text)).toEqual(['DEPART', 'AGADEZ'])
  })

  it('ignore les lignes vides', () => {
    const data = {
      blocks: [
        {
          paragraphs: [
            { lines: [{ words: [] }, { words: [{ text: '  ', bbox: { x0: 0, y0: 0, x1: 4, y1: 20 } }] }] },
          ],
        },
      ],
    }
    expect(linesFromTessData(data)).toHaveLength(0)
  })

  it('renvoie [] si données absentes', () => {
    expect(linesFromTessData({})).toEqual([])
  })
})
```

- [ ] **Step 3: Lancer le test pour vérifier l'échec**

```bash
npx vitest run tests/ocr-flatten.test.ts
```

Expected: FAIL — module `@/lib/planning/ocr` introuvable.

- [ ] **Step 4: Implémenter le module OCR**

Create `src/lib/planning/ocr.ts`:

```ts
import { createWorker } from 'tesseract.js'
import type { OcrLine, OcrToken } from '@/lib/planning/parse'

export function linesFromTessData(data: unknown): OcrLine[] {
  const lines: OcrLine[] = []
  const blocks = (data as { blocks?: unknown[] })?.blocks ?? []
  for (const block of blocks) {
    const paragraphs = (block as { paragraphs?: unknown[] })?.paragraphs ?? []
    for (const paragraph of paragraphs) {
      const rawLines = (paragraph as { lines?: unknown[] })?.lines ?? []
      for (const rawLine of rawLines) {
        const rawWords = (rawLine as { words?: unknown[] })?.words ?? []
        const tokens: OcrToken[] = []
        for (const rawWord of rawWords) {
          const text = (rawWord as { text?: string })?.text?.trim() ?? ''
          if (!text) continue
          const bbox = (rawWord as { bbox?: { x0?: number; y0?: number; x1?: number; y1?: number } })?.bbox
          tokens.push({
            text,
            x0: bbox?.x0 ?? 0,
            y0: bbox?.y0 ?? 0,
            x1: bbox?.x1 ?? 0,
            y1: bbox?.y1 ?? 0,
          })
        }
        if (tokens.length === 0) continue
        const minY = Math.min(...tokens.map((t) => t.y0))
        const maxY = Math.max(...tokens.map((t) => t.y1))
        lines.push({ tokens, y: (minY + maxY) / 2 })
      }
    }
  }
  return lines.sort((a, b) => a.y - b.y)
}

export async function runOcr(image: File | Blob): Promise<OcrLine[]> {
  const worker = await createWorker('fra')
  try {
    const { data } = await worker.recognize(image)
    return linesFromTessData(data)
  } finally {
    await worker.terminate()
  }
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run tests/ocr-flatten.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/planning/ocr.ts tests/ocr-flatten.test.ts && git commit -m "feat: module OCR tesseract.js"
```

---

### Task 6: Clients Supabase + middleware + composants UI de base

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/middleware.ts`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/Select.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/EmptyState.tsx`
- Test: `tests/ui-basics.test.tsx`

**Interfaces:**
- Produces: `createClient()` navigateur (`@/lib/supabase/client`), `createClient()` serveur async (`@/lib/supabase/server`), middleware de rafraîchissement de session, composants `Button`, `Card`, `Input`, `Select`, `Badge`, `EmptyState` (tous avec `data-testid`).

- [ ] **Step 1: Installer les dépendances Supabase**

```bash
npm install @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Créer le client navigateur**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Créer le client serveur (async cookies, Next 15+)**

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // appelé depuis un Server Component — ignoré
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Créer le middleware**

Create `src/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value }) => supabaseResponse.cookies.set(name, value))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isLogin = request.nextUrl.pathname.startsWith('/login')

  if (!user && !isLogin) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && isLogin) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 5: Créer les composants UI de base**

Create `src/components/ui/Button.tsx`:

```tsx
import { type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const styles: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'bg-transparent text-blue-600 hover:bg-blue-50',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

export function Button({ variant = 'primary', children, className = '', ...rest }: Props) {
  return (
    <button
      data-testid="button"
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
```

Create `src/components/ui/Card.tsx`:

```tsx
import { type ReactNode } from 'react'

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div data-testid="card" className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      {title ? <h2 className="mb-3 text-base font-bold text-gray-900">{title}</h2> : null}
      {children}
    </div>
  )
}
```

Create `src/components/ui/Input.tsx`:

```tsx
import { type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', id, ...rest }: Props) {
  return (
    <label className="block text-sm text-gray-700" htmlFor={id}>
      {label ? <span className="mb-1 block font-medium">{label}</span> : null}
      <input
        data-testid="input"
        id={id}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${className}`}
        {...rest}
      />
    </label>
  )
}
```

Create `src/components/ui/Select.tsx`:

```tsx
import { type SelectHTMLAttributes } from 'react'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export function Select({ label, options, className = '', id, ...rest }: Props) {
  return (
    <label className="block text-sm text-gray-700" htmlFor={id}>
      {label ? <span className="mb-1 block font-medium">{label}</span> : null}
      <select
        data-testid="select"
        id={id}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${className}`}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
```

Create `src/components/ui/Badge.tsx`:

```tsx
import { type ReactNode } from 'react'

type Tone = 'neutral' | 'green' | 'amber' | 'blue'

const tones: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-800',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span data-testid="badge" className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}
```

Create `src/components/ui/EmptyState.tsx`:

```tsx
export function EmptyState({ message }: { message: string }) {
  return (
    <div data-testid="empty-state" className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
      {message}
    </div>
  )
}
```

Create `src/components/ui/index.ts` (barrel d'export utilisé partout dans l'app) :

```ts
export { Button } from './Button'
export { Card } from './Card'
export { Input } from './Input'
export { Select } from './Select'
export { Badge } from './Badge'
export { EmptyState } from './EmptyState'
```

- [ ] **Step 6: Écrire le test qui échoue**

Create `tests/ui-basics.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatFcfa } from '@/lib/fuel/calculations'

describe('UI de base', () => {
  it('rend un bouton avec son libellé', () => {
    render(<Button>Enregistrer</Button>)
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument()
  })
  it('rend un badge avec du texte', () => {
    render(<Badge tone="green">Payé</Badge>)
    expect(screen.getByText('Payé')).toBeInTheDocument()
  })
  it('rend un état vide', () => {
    render(<EmptyState message="Aucun départ" />)
    expect(screen.getByText('Aucun départ')).toBeInTheDocument()
  })
  it('formate les montants', () => {
    expect(formatFcfa(12000)).toBe('12 000 FCFA')
  })
})
```

- [ ] **Step 7: Lancer le test pour vérifier l'échec**

```bash
npx vitest run tests/ui-basics.test.tsx
```

Expected: FAIL — modules de composants introuvables.

- [ ] **Step 8: Créer les fichiers des composants (Step 5) puis relancer**

```bash
npx vitest run tests/ui-basics.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/supabase src/middleware.ts src/components/ui tests/ui-basics.test.tsx && git commit -m "feat: clients supabase, middleware, composants ui de base"
```

---

### Task 7: Authentification — page de connexion + coque protégée

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/page.tsx`
- Create: `src/app/login/page.tsx`
- Create: `src/components/auth/LoginForm.tsx`
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/components/layout/NavLinks.tsx`
- Test: `tests/login-form.test.tsx`

**Interfaces:**
- Consumes: `createClient()` serveur + navigateur, `Profile`, composants UI.
- Produces: route `/login` (formulaire), zone `(app)` protégée avec `AppShell` (nav responsive) et une page d'accueil temporaire « Départs du jour » (remplie en Task 8).

- [ ] **Step 1: Écrire le test du formulaire de connexion (échoue)**

Create `tests/login-form.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginForm } from '@/components/auth/LoginForm'

const mockSignIn = vi.fn()
const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signInWithPassword: mockSignIn },
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

describe('LoginForm', () => {
  beforeEach(() => {
    mockSignIn.mockReset()
    mockPush.mockReset()
    mockRefresh.mockReset()
  })

  it('affiche une erreur si la connexion échoue', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Identifiants invalides' } })
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    await waitFor(() => expect(screen.getByText('Identifiants invalides')).toBeInTheDocument())
  })

  it('redirige vers la racine après succès', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'))
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

```bash
npx vitest run tests/login-form.test.tsx
```

Expected: FAIL — module `@/components/auth/LoginForm` introuvable.

- [ ] **Step 3: Implémenter le formulaire de connexion**

Create `src/components/auth/LoginForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Input } from '@/components/ui'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError('Identifiants invalides')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Connexion</h1>
      <Input id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input id="password" label="Mot de passe" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Créer la page login**

Create `src/app/login/page.tsx`:

```tsx
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <LoginForm />
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Créer la navigation et la coque**

Create `src/components/layout/NavLinks.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Profile } from '@/lib/types'

export function NavLinks({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const links = [
    { href: '/', label: 'Départs' },
    { href: '/scanner', label: 'Scanner' },
    { href: '/historique', label: 'Historique' },
    { href: '/recus', label: 'Reçus' },
  ]
  if (profile.role === 'admin') {
    links.push({ href: '/admin', label: 'Admin' })
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="flex gap-1" data-testid="nav">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            isActive(link.href) ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
```

Create `src/components/layout/AppShell.tsx`:

```tsx
import type { ReactNode } from 'react'
import type { Profile } from '@/lib/types'
import { NavLinks } from './NavLinks'

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-gray-200 bg-white p-4 lg:flex">
        <div className="mb-6 text-base font-bold text-gray-900">Service d'achat</div>
        <div className="flex flex-1 flex-col gap-1">
          <NavLinks profile={profile} />
        </div>
        <div className="text-xs text-gray-500">
          <p className="font-medium text-gray-700">{profile.full_name}</p>
          <p className="capitalize">{profile.role === 'admin' ? 'Administrateur' : 'Service achat'}</p>
        </div>
      </aside>

      {/* Contenu */}
      <div className="lg:pl-56">
        {/* Barre du haut mobile */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <span className="text-base font-bold text-gray-900">Service d'achat</span>
          <span className="text-xs text-gray-500">{profile.full_name}</span>
        </header>

        <main className="mx-auto max-w-5xl p-4 pb-24 lg:p-6 lg:pb-6">{children}</main>

        {/* Bottom nav mobile */}
        <nav className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white px-2 py-2 lg:hidden" data-testid="bottom-nav">
          <NavLinks profile={profile} />
        </nav>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Créer la coque protégée et la page d'accueil temporaire**

Create `src/app/(app)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return <AppShell profile={profile}>{children}</AppShell>
}
```

Create `src/app/(app)/page.tsx` (temporaire, remplacée en Task 8) :

```tsx
import { EmptyState } from '@/components/ui/EmptyState'

export default function HomePage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Départs du jour</h1>
      <EmptyState message="L'écran des départs arrive dans la prochaine étape." />
    </div>
  )
}
```

- [ ] **Step 7: Vérifier que le test passe puis build**

```bash
npx vitest run tests/login-form.test.tsx
npm run build
```

Expected: test PASS, build OK.

- [ ] **Step 8: Commit**

```bash
git add src/app src/components/auth src/components/layout tests/login-form.test.tsx && git commit -m "feat: authentification et coque protégée"
```

---

### Task 8: Écran Départs du jour — liste groupée + statuts carburant

**Files:**
- Create: `src/lib/supabase/queries.ts`
- Create: `src/components/departures/StatusBadge.tsx`
- Create: `src/components/departures/DepartureList.tsx`
- Create: `src/components/departures/DatePicker.tsx`
- Create: `src/components/departures/DeparturesScreen.tsx`
- Modify: `src/app/(app)/page.tsx`
- Test: `tests/departures.test.tsx`

**Interfaces:**
- Consumes: `Departure`, `Fueling`, `DepartureWithFuel`, `FuelType`, `originOf`, composants UI.
- Produces: `fetchDeparturesForDate(supabase, date)`, `fetchFuelingsForDate(supabase, date)`, `fetchFuelPrices(supabase)`, `StatusBadge({ fuelingStatus })`, `DepartureList`, `DeparturesScreen`.

- [ ] **Step 1: Créer les requêtes Supabase**

Create `src/lib/supabase/queries.ts`:

```ts
import type { Departure, Fueling, FuelPrice } from '@/lib/types'

type Supabase = {
  from: (table: string) => any
}

export async function fetchDeparturesForDate(supabase: Supabase, date: string): Promise<Departure[]> {
  const { data } = await supabase
    .from('departures')
    .select('*, plannings!inner(date)')
    .eq('plannings.date', date)
    .order('departure_time')
  return (data ?? []) as Departure[]
}

export async function fetchFuelingsForDate(supabase: Supabase, date: string): Promise<Fueling[]> {
  const { data } = await supabase
    .from('fuelings')
    .select('*')
    .eq('date', date)
    .order('created_at')
  return (data ?? []) as Fueling[]
}

export async function fetchFuelPrices(supabase: Supabase): Promise<FuelPrice[]> {
  const { data } = await supabase
    .from('fuel_prices')
    .select('*')
    .order('effective_date')
  return (data ?? []) as FuelPrice[]
}
```

- [ ] **Step 2: Écrire le test qui échoue**

Create `tests/departures.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/departures/StatusBadge'
import { DepartureList } from '@/components/departures/DepartureList'
import type { DepartureWithFuel } from '@/lib/types'

const departure = (overrides: Partial<DepartureWithFuel> = {}): DepartureWithFuel => ({
  id: 'd1',
  planning_id: 'p1',
  axis: 'AGADEZ - NIAMEY',
  bus_number: 'CG 6377',
  departure_time: '05 H 00',
  driver_name: 'YOUSSOUF',
  driver_phone: '96474717',
  backup_driver: null,
  backup_phone: null,
  fuelings: [],
  ...overrides,
})

describe('StatusBadge', () => {
  it('affiche « Pas de plein » sans reçu', () => {
    render(<StatusBadge status="empty" />)
    expect(screen.getByText('Pas de plein')).toBeInTheDocument()
  })
  it('affiche « Plein fait » quand non payé', () => {
    render(<StatusBadge status="fueled" />)
    expect(screen.getByText('Plein fait')).toBeInTheDocument()
  })
  it('affiche « Payé » quand payé', () => {
    render(<StatusBadge status="paid" />)
    expect(screen.getByText('Payé')).toBeInTheDocument()
  })
})

describe('DepartureList', () => {
  it('groupe les départs par ville d’origine', () => {
    const rows: DepartureWithFuel[] = [
      departure({ id: '1', axis: 'AGADEZ - NIAMEY' }),
      departure({ id: '2', axis: 'AGADEZ - ARLIT' }),
      departure({ id: '3', axis: 'INGAL - AGADEZ' }),
    ]
    render(<DepartureList departures={rows} />)
    expect(screen.getByRole('heading', { name: 'AGADEZ' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'INGAL' })).toBeInTheDocument()
    expect(screen.getAllByTestId('departure-row')).toHaveLength(3)
  })
  it('affiche le montant total des reçus d’un départ', () => {
    const rows: DepartureWithFuel[] = [
      departure({
        id: '1',
        fuelings: [
          { id: 'f1', date: '2026-08-06', departure_id: 'd1', bus_number: 'CG 6377', driver_name: 'YOUSSOUF', fuel_type: 'diesel', liters: 100, unit_price: 618, amount: 61800, paid: false, paid_at: null, recorded_by: null, created_at: '' },
          { id: 'f2', date: '2026-08-06', departure_id: 'd1', bus_number: 'CG 6377', driver_name: 'YOUSSOUF', fuel_type: 'diesel', liters: 50, unit_price: 618, amount: 30900, paid: false, paid_at: null, recorded_by: null, created_at: '' },
        ],
      }),
    ]
    render(<DepartureList departures={rows} />)
    expect(screen.getByText('92 700 FCFA')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Lancer le test pour vérifier l'échec**

```bash
npx vitest run tests/departures.test.tsx
```

Expected: FAIL — modules de composants introuvables.

- [ ] **Step 4: Implémenter StatusBadge**

Create `src/components/departures/StatusBadge.tsx`:

```tsx
import { Badge } from '@/components/ui/Badge'

export type FuelingStatus = 'empty' | 'fueled' | 'paid'

const config: Record<FuelingStatus, { label: string; tone: 'neutral' | 'amber' | 'green' }> = {
  empty: { label: 'Pas de plein', tone: 'neutral' },
  fueled: { label: 'Plein fait', tone: 'amber' },
  paid: { label: 'Payé', tone: 'green' },
}

export function StatusBadge({ status }: { status: FuelingStatus }) {
  const c = config[status]
  return <Badge tone={c.tone}>{c.label}</Badge>
}
```

- [ ] **Step 5: Implémenter DepartureList**

Create `src/components/departures/DepartureList.tsx`:

```tsx
import type { DepartureWithFuel } from '@/lib/types'
import { originOf } from '@/lib/planning/parse'
import { sumAmounts, formatFcfa } from '@/lib/fuel/calculations'
import { StatusBadge, type FuelingStatus } from './StatusBadge'

export function DepartureList({ departures, onFuel }: { departures: DepartureWithFuel[]; onFuel?: (d: DepartureWithFuel) => void }) {
  const groups = new Map<string, DepartureWithFuel[]>()
  for (const d of departures) {
    const city = originOf(d.axis)
    if (!groups.has(city)) groups.set(city, [])
    groups.get(city)!.push(d)
  }

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([city, rows]) => (
        <section key={city}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">{city}</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {rows.map((d) => {
              const total = sumAmounts(d.fuelings)
              const paid = d.fuelings.length > 0 && d.fuelings.every((f) => f.paid)
              const status: FuelingStatus = d.fuelings.length === 0 ? 'empty' : paid ? 'paid' : 'fueled'
              return (
                <button
                  key={d.id}
                  data-testid="departure-row"
                  onClick={() => onFuel?.(d)}
                  className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{d.bus_number}</div>
                    <div className="truncate text-sm text-gray-600">{d.axis}</div>
                    <div className="text-xs text-gray-400">
                      {d.departure_time || '—'} · {d.driver_name || '—'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {d.fuelings.length > 0 ? <span className="text-sm font-bold text-gray-900">{formatFcfa(total)}</span> : null}
                    <StatusBadge status={status} />
                  </div>
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

- [ ] **Step 6: Implémenter DatePicker et l'écran**

Create `src/components/departures/DatePicker.tsx`:

```tsx
import { Input } from '@/components/ui/Input'

export function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input id="date" label="Date" type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  )
}
```

Create `src/components/departures/DeparturesScreen.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Departure, DepartureWithFuel, Fueling } from '@/lib/types'
import { fetchDeparturesForDate, fetchFuelingsForDate } from '@/lib/supabase/queries'
import { sumAmounts, formatFcfa, todayLocalISO } from '@/lib/fuel/calculations'
import { DatePicker } from './DatePicker'
import { DepartureList } from './DepartureList'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button, Card } from '@/components/ui'
import { FuelingSheet } from '@/components/fuel/FuelingSheet'

export function DeparturesScreen() {
  const [date, setDate] = useState(todayLocalISO())
  const [departures, setDepartures] = useState<DepartureWithFuel[]>([])
  const [fuelings, setFuelings] = useState<Fueling[]>([])
  const [selected, setSelected] = useState<DepartureWithFuel | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async (d: string) => {
    setLoading(true)
    const [deps, fuels] = await Promise.all([
      fetchDeparturesForDate(supabase, d),
      fetchFuelingsForDate(supabase, d),
    ])
    const byId = new Map<string, Fueling[]>()
    for (const f of fuels) {
      if (!f.departure_id) continue
      if (!byId.has(f.departure_id)) byId.set(f.departure_id, [])
      byId.get(f.departure_id)!.push(f)
    }
    const rows: DepartureWithFuel[] = (deps as Departure[]).map((d) => ({ ...d, fuelings: byId.get(d.id) ?? [] }))
    setDepartures(rows)
    setFuelings(fuels)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load(date)
  }, [date, load])

  const grandTotal = sumAmounts(fuelings)
  const pendingCount = fuelings.filter((f) => !f.paid).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Départs du jour</h1>
        <DatePicker value={date} onChange={setDate} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Card className="flex-1 min-w-40">
          <p className="text-xs text-gray-500">Grand total de la journée</p>
          <p data-testid="grand-total" className="text-xl font-bold text-gray-900">{formatFcfa(grandTotal)}</p>
        </Card>
        <Card className="flex-1 min-w-40">
          <p className="text-xs text-gray-500">Reçus à payer</p>
          <p data-testid="pending-count" className="text-xl font-bold text-gray-900">{pendingCount}</p>
        </Card>
        <Button variant="secondary" disabled={pendingCount === 0} onClick={async () => {
          const { error } = await supabase
            .from('fuelings')
            .update({ paid: true, paid_at: new Date().toISOString() })
            .eq('date', date)
            .eq('paid', false)
          if (!error) load(date)
        }}>
          Tout payer
        </Button>
      </div>

      {loading ? <p className="text-sm text-gray-500">Chargement…</p> : departures.length === 0 ? (
        <EmptyState message="Aucun départ prévu pour cette date." />
      ) : (
        <DepartureList departures={departures} onFuel={(d) => setSelected(d)} />
      )}

      {selected ? (
        <FuelingSheet
          departure={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null)
            load(date)
          }}
        />
      ) : null}
    </div>
  )
}
```

- [ ] **Step 7: Brancher la page d'accueil**

Modify `src/app/(app)/page.tsx`:

```tsx
import { DeparturesScreen } from '@/components/departures/DeparturesScreen'

export default function HomePage() {
  return <DeparturesScreen />
}
```

- [ ] **Step 8: Lancer les tests puis le build**

```bash
npx vitest run tests/departures.test.tsx
npm run build
```

Note : le build peut échouer tant que `FuelingSheet` (Task 9) n'existe pas. Si c'est le cas, créer un stub vide dans `src/components/fuel/FuelingSheet.tsx` pour que le build passe, et l'implémenter réellement en Task 9. Expected: tests PASS, build OK.

- [ ] **Step 9: Commit**

```bash
git add src/lib/supabase/queries.ts src/components/departures src/app/\(app\)/page.tsx tests/departures.test.tsx && git commit -m "feat: écran départs du jour groupés par ville"
```

---

### Task 9: Saisie carburant (reçus) + grand total + paiement

**Files:**
- Create: `src/components/fuel/FuelingSheet.tsx`
- Create: `src/components/fuel/FuelingForm.tsx`
- Test: `tests/fueling.test.tsx`

**Interfaces:**
- Consumes: `DepartureWithFuel`, `FuelPrice`, `computeAmount`, `latestPrice`, `formatFcfa`, `createClient()` navigateur.
- Produces: `FuelingSheet({ departure, onClose, onSaved })` (feuille modale) et `FuelingForm` (formulaire litres + type + montant auto + total du départ).

- [ ] **Step 1: Écrire le test qui échoue**

Create `tests/fueling.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FuelingForm } from '@/components/fuel/FuelingForm'
import { todayLocalISO } from '@/lib/fuel/calculations'
import type { DepartureWithFuel, FuelPrice } from '@/lib/types'

const departure: DepartureWithFuel = {
  id: 'd1',
  planning_id: 'p1',
  axis: 'AGADEZ - NIAMEY',
  bus_number: 'CG 6377',
  departure_time: '05 H 00',
  driver_name: 'YOUSSOUF',
  driver_phone: '96474717',
  backup_driver: null,
  backup_phone: null,
  fuelings: [],
}

const prices: FuelPrice[] = [
  { id: '1', fuel_type: 'diesel', price: 618, effective_date: '2026-08-01', created_by: null, created_at: '' },
  { id: '2', fuel_type: 'essence', price: 499, effective_date: '2026-08-01', created_by: null, created_at: '' },
]

const mockInsert = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) =>
      table === 'fuelings'
        ? { insert: mockInsert }
        : { select: () => ({ order: () => Promise.resolve({ data: prices }) }) },
  }),
}))

describe('FuelingForm', () => {
  it('pré-remplit bus et chauffeur depuis le départ', () => {
    render(<FuelingForm departure={departure} onSaved={() => {}} />)
    expect(screen.getByText('CG 6377')).toBeInTheDocument()
    expect(screen.getByText('YOUSSOUF')).toBeInTheDocument()
  })

  it('calcule le montant automatiquement (litres × prix diesel)', () => {
    render(<FuelingForm departure={departure} onSaved={() => {}} />)
    fireEvent.change(screen.getByLabelText(/litres/i), { target: { value: '300' } })
    expect(screen.getByTestId('amount')).toHaveTextContent('185 400 FCFA')
  })

  it('enregistre le reçu avec bus, chauffeur, prix et montant', async () => {
    mockInsert.mockResolvedValue({ error: null })
    render(<FuelingForm departure={departure} onSaved={() => {}} />)
    fireEvent.change(screen.getByLabelText(/litres/i), { target: { value: '300' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le plein/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    const arg = mockInsert.mock.calls[0][0]
    expect(arg).toMatchObject({
      date: todayLocalISO(),
      departure_id: 'd1',
      bus_number: 'CG 6377',
      driver_name: 'YOUSSOUF',
      fuel_type: 'diesel',
      liters: 300,
      unit_price: 618,
      amount: 185400,
    })
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

```bash
npx vitest run tests/fueling.test.tsx
```

Expected: FAIL — module `@/components/fuel/FuelingForm` introuvable.

- [ ] **Step 3: Implémenter FuelingForm**

Create `src/components/fuel/FuelingForm.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DepartureWithFuel, FuelPrice, FuelType } from '@/lib/types'
import { computeAmount, formatFcfa, latestPrice, sumAmounts, todayLocalISO } from '@/lib/fuel/calculations'
import { Button, Input, Select } from '@/components/ui'

interface Props {
  departure: DepartureWithFuel
  onSaved: () => void
}

export function FuelingForm({ departure, onSaved }: Props) {
  const supabase = createClient()
  const [type, setType] = useState<FuelType>('diesel')
  const [liters, setLiters] = useState('')
  const [prices, setPrices] = useState<FuelPrice[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('fuel_prices').select('*').order('effective_date').then(({ data }) => setPrices((data ?? []) as FuelPrice[]))
  }, [supabase])

  const today = todayLocalISO()
  const unitPrice = latestPrice(prices, type, today) ?? 0
  const amount = computeAmount(Number(liters) || 0, unitPrice)
  const departureTotal = sumAmounts(departure.fuelings) + amount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const l = Number(liters)
    if (!l || l <= 0) {
      setError('Saisissez une quantité en litres.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('fuelings').insert({
      date: today,
      departure_id: departure.id,
      bus_number: departure.bus_number,
      driver_name: departure.driver_name,
      fuel_type: type,
      liters: l,
      unit_price: unitPrice,
      amount,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-gray-50 p-3 text-sm">
        <p className="font-bold text-gray-900">{departure.bus_number}</p>
        <p className="text-gray-600">{departure.axis}</p>
        <p className="text-gray-500">{departure.driver_name} · {departure.departure_time}</p>
      </div>

      <Select
        id="type"
        label="Type de carburant"
        value={type}
        onChange={(e) => setType(e.target.value as FuelType)}
        options={[
          { value: 'diesel', label: 'Diesel' },
          { value: 'essence', label: 'Essence' },
        ]}
      />

      <Input
        id="liters"
        label="Quantité (litres)"
        type="number"
        step="0.5"
        min="0"
        inputMode="decimal"
        placeholder="ex. 300"
        value={liters}
        onChange={(e) => setLiters(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500">Prix du litre</p>
          <p className="font-semibold text-gray-900">{unitPrice ? formatFcfa(unitPrice) : '—'}</p>
        </div>
        <div>
          <p className="text-gray-500">Montant</p>
          <p data-testid="amount" className="font-bold text-gray-900">{formatFcfa(amount)}</p>
        </div>
      </div>
      <div className="rounded-lg bg-blue-50 p-3 text-sm">
        <p className="text-gray-600">Total du départ (avec ce plein)</p>
        <p className="text-lg font-bold text-blue-900">{formatFcfa(departureTotal)}</p>
      </div>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Enregistrement…' : 'Enregistrer le plein'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Implémenter FuelingSheet (modale)**

Create `src/components/fuel/FuelingSheet.tsx`:

```tsx
'use client'

import type { DepartureWithFuel } from '@/lib/types'
import { FuelingForm } from './FuelingForm'

interface Props {
  departure: DepartureWithFuel
  onClose: () => void
  onSaved: () => void
}

export function FuelingSheet({ departure, onClose, onSaved }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        data-testid="fueling-sheet"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Plein de carburant</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100" aria-label="Fermer">
            ✕
          </button>
        </div>
        <FuelingForm departure={departure} onSaved={onSaved} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run tests/fueling.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/fuel tests/fueling.test.tsx && git commit -m "feat: saisie carburant avec prix automatique et montant"
```

---

### Task 10: Scanner un planning — upload, OCR, validation, enregistrement

**Files:**
- Create: `src/app/(app)/scanner/page.tsx`
- Create: `src/components/scanner/ScanForm.tsx`
- Create: `src/components/scanner/PreviewTable.tsx`
- Test: `tests/scanner.test.tsx`

**Interfaces:**
- Consumes: `runOcr`, `parsePlanning`, `ParsedPlanning`, `createClient()`.
- Produces: route `/scanner` complète (upload photos → OCR → aperçu éditable → enregistrement dans `plannings` + `departures`, photos dans le bucket `plannings`).

- [ ] **Step 1: Écrire le test de l'aperçu éditable (échoue)**

Create `tests/scanner.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreviewTable } from '@/components/scanner/PreviewTable'
import type { ParsedPlanning } from '@/lib/planning/parse'

const planning: ParsedPlanning = {
  date: '2026-08-06',
  sections: [
    {
      originCity: 'AGADEZ',
      departures: [
        { axis: 'AGADEZ - NIAMEY', busNumber: 'CG 6377', departureTime: '05 H 00', driverName: 'YOUSSOUF', driverPhone: '96474717', backupDriver: '', backupPhone: '' },
      ],
    },
  ],
}

describe('PreviewTable', () => {
  it('affiche les lignes extraites', () => {
    render(<PreviewTable planning={planning} onChange={() => {}} />)
    expect(screen.getByDisplayValue('CG 6377')).toBeInTheDocument()
    expect(screen.getByDisplayValue('YOUSSOUF')).toBeInTheDocument()
  })

  it('permet de corriger le numéro de bus', () => {
    let updated: ParsedPlanning | null = null
    render(<PreviewTable planning={planning} onChange={(p) => (updated = p)} />)
    const input = screen.getByDisplayValue('CG 6377')
    fireEvent.change(input, { target: { value: 'CG 6388' } })
    expect(updated!.sections[0].departures[0].busNumber).toBe('CG 6388')
  })

  it('permet de supprimer une ligne parasite', () => {
    let updated: ParsedPlanning | null = null
    render(<PreviewTable planning={planning} onChange={(p) => (updated = p)} />)
    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))
    expect(updated!.sections[0].departures).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

```bash
npx vitest run tests/scanner.test.tsx
```

Expected: FAIL — module `@/components/scanner/PreviewTable` introuvable.

- [ ] **Step 3: Implémenter PreviewTable**

Create `src/components/scanner/PreviewTable.tsx`:

```tsx
'use client'

import type { ParsedPlanning } from '@/lib/planning/parse'
import { Button } from '@/components/ui/Button'

interface Props {
  planning: ParsedPlanning
  onChange: (p: ParsedPlanning) => void
}

export function PreviewTable({ planning, onChange }: Props) {
  function updateRow(sectionIdx: number, rowIdx: number, field: keyof ParsedPlanning['sections'][number]['departures'][number], value: string) {
    const next = structuredClone(planning)
    next.sections[sectionIdx].departures[rowIdx][field] = value
    onChange(next)
  }

  function removeRow(sectionIdx: number, rowIdx: number) {
    const next = structuredClone(planning)
    next.sections[sectionIdx].departures.splice(rowIdx, 1)
    onChange(next)
  }

  return (
    <div className="space-y-6">
      {planning.sections.map((section, si) => (
        <div key={si} className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-2 text-sm font-bold text-gray-700">
            Départ {section.originCity || '—'}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-3 py-2">Axe</th>
                <th className="px-3 py-2">N° Bus</th>
                <th className="px-3 py-2">Heure</th>
                <th className="px-3 py-2">Chauffeur</th>
                <th className="px-3 py-2">Téléphone</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {section.departures.map((d, ri) => (
                <tr key={ri} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-3 py-1">
                    <input className="w-full min-w-40 rounded border border-gray-200 px-2 py-1" value={d.axis} onChange={(e) => updateRow(si, ri, 'axis', e.target.value)} />
                  </td>
                  <td className="px-3 py-1">
                    <input className="w-24 rounded border border-gray-200 px-2 py-1" value={d.busNumber} onChange={(e) => updateRow(si, ri, 'busNumber', e.target.value)} />
                  </td>
                  <td className="px-3 py-1">
                    <input className="w-20 rounded border border-gray-200 px-2 py-1" value={d.departureTime} onChange={(e) => updateRow(si, ri, 'departureTime', e.target.value)} />
                  </td>
                  <td className="px-3 py-1">
                    <input className="w-full min-w-36 rounded border border-gray-200 px-2 py-1" value={d.driverName} onChange={(e) => updateRow(si, ri, 'driverName', e.target.value)} />
                  </td>
                  <td className="px-3 py-1">
                    <input className="w-28 rounded border border-gray-200 px-2 py-1" value={d.driverPhone} onChange={(e) => updateRow(si, ri, 'driverPhone', e.target.value)} />
                  </td>
                  <td className="px-3 py-1">
                    <Button variant="ghost" type="button" onClick={() => removeRow(si, ri)}>Supprimer</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run tests/scanner.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Implémenter ScanForm**

Create `src/components/scanner/ScanForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { runOcr } from '@/lib/planning/ocr'
import { parsePlanning, type ParsedPlanning } from '@/lib/planning/parse'
import { todayLocalISO } from '@/lib/fuel/calculations'
import { Button, Input, EmptyState } from '@/components/ui'
import { PreviewTable } from './PreviewTable'

export function ScanForm() {
  const supabase = createClient()
  const [date, setDate] = useState(todayLocalISO())
  const [sourceLabel, setSourceLabel] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [preview, setPreview] = useState<ParsedPlanning | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleScan() {
    setError('')
    if (photos.length === 0) {
      setError('Ajoutez au moins une photo du planning.')
      return
    }
    setBusy(true)
    const lines = []
    for (const photo of photos) {
      try {
        const l = await runOcr(photo)
        lines.push(...l)
      } catch {
        setError('Lecture de la photo impossible. Réessayez avec une meilleure photo.')
        setBusy(false)
        return
      }
    }
    const parsed = parsePlanning(lines)
    if (parsed.date && !date) setDate(parsed.date)
    setPreview(parsed)
    setBusy(false)
    setDone(true)
  }

  async function handleSave() {
    if (!preview) return
    setError('')
    setBusy(true)

    const imageUrls: string[] = []
    for (const photo of photos) {
      const path = `${date}/${crypto.randomUUID()}.jpg`
      const { error: upErr } = await supabase.storage.from('plannings').upload(path, photo)
      if (upErr) {
        setError(`Upload de la photo impossible : ${upErr.message}`)
        setBusy(false)
        return
      }
      const { data: pub } = supabase.storage.from('plannings').getPublicUrl(path)
      imageUrls.push(pub.publicUrl)
    }

    const { data: planning, error: pErr } = await supabase
      .from('plannings')
      .insert({ date, source_label: sourceLabel || 'Planning', image_urls: imageUrls })
      .select()
      .single()
    if (pErr) {
      setError(pErr.message)
      setBusy(false)
      return
    }

    const rows = preview.sections.flatMap((s) =>
      s.departures.map((d) => ({
        planning_id: planning.id,
        axis: d.axis,
        bus_number: d.busNumber,
        departure_time: d.departureTime,
        driver_name: d.driverName,
        driver_phone: d.driverPhone,
        backup_driver: d.backupDriver || null,
        backup_phone: d.backupPhone || null,
      }))
    )
    const { error: dErr } = await supabase.from('departures').insert(rows)
    if (dErr) {
      setError(dErr.message)
      setBusy(false)
      return
    }
    setBusy(false)
    setPreview(null)
    setPhotos([])
    alert('Planning enregistré ✓')
  }

  if (done && preview) {
    return (
      <div className="space-y-4">
        <PreviewTable planning={preview} onChange={setPreview} />
        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer le planning'}
          </Button>
          <Button variant="secondary" onClick={() => { setDone(false); setPreview(null) }}>
            Retour
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input id="sc-date" label="Date du planning" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input id="sc-source" label="Libellé (ex. Feuille Agadez)" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Photo(s) du planning</label>
        <input
          data-testid="photo-input"
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        {photos.length > 0 ? <p className="mt-1 text-xs text-gray-500">{photos.length} photo(s) sélectionnée(s)</p> : null}
      </div>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <Button onClick={handleScan} disabled={busy}>
        {busy ? 'Lecture de la photo…' : 'Lire le planning'}
      </Button>

      {photos.length === 0 ? <EmptyState message="Photographiez la feuille de planning ou choisissez un fichier." /> : null}
    </div>
  )
}
```

- [ ] **Step 6: Créer la page scanner**

Create `src/app/(app)/scanner/page.tsx`:

```tsx
import { ScanForm } from '@/components/scanner/ScanForm'

export default function ScannerPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Scanner un planning</h1>
      <p className="text-sm text-gray-500">
        Photographiez la feuille de planning. Le système lit le tableau automatiquement, puis vous validez et corrigez avant l'enregistrement.
      </p>
      <ScanForm />
    </div>
  )
}
```

- [ ] **Step 7: Vérifier build**

```bash
npx vitest run tests/scanner.test.tsx && npm run build
```

Expected: tests PASS, build OK.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/scanner src/components/scanner tests/scanner.test.tsx && git commit -m "feat: scan du planning avec OCR et validation"
```

---

### Task 11: Historique des plannings + des reçus

**Files:**
- Create: `src/app/(app)/historique/page.tsx`
- Create: `src/app/(app)/recus/page.tsx`
- Create: `src/components/history/PlanningsList.tsx`
- Create: `src/components/history/ReceiptsList.tsx`
- Test: `tests/history.test.tsx`

**Interfaces:**
- Consumes: `Planning`, `Fueling`, `fetchFuelingsForDate`, `sumAmounts`, `formatFcfa`, `createClient()`.
- Produces: routes `/historique` (liste des plannings par date, détail) et `/recus` (liste des reçus filtrable, totaux).

- [ ] **Step 1: Écrire le test qui échoue**

Create `tests/history.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlanningsList } from '@/components/history/PlanningsList'
import { ReceiptsList } from '@/components/history/ReceiptsList'
import type { Planning, Fueling } from '@/lib/types'

const plannings: Planning[] = [
  { id: 'p1', date: '2026-08-06', source_label: 'Agadez', image_urls: [], created_by: null, created_at: '' },
  { id: 'p2', date: '2026-08-05', source_label: 'Niamey', image_urls: [], created_by: null, created_at: '' },
]

const fuelings: Fueling[] = [
  { id: 'f1', date: '2026-08-06', departure_id: null, bus_number: 'CG 6377', driver_name: 'YOUSSOUF', fuel_type: 'diesel', liters: 300, unit_price: 618, amount: 185400, paid: false, paid_at: null, recorded_by: null, created_at: '' },
  { id: 'f2', date: '2026-08-06', departure_id: null, bus_number: 'BH 8210', driver_name: 'MANSOUR', fuel_type: 'essence', liters: 200, unit_price: 499, amount: 99800, paid: true, paid_at: '2026-08-06T18:00:00Z', recorded_by: null, created_at: '' },
]

describe('PlanningsList', () => {
  it('liste les plannings par date décroissante', () => {
    render(<PlanningsList plannings={plannings} />)
    const rows = screen.getAllByTestId('planning-row')
    expect(rows[0]).toHaveTextContent('2026-08-06')
    expect(rows[1]).toHaveTextContent('2026-08-05')
  })
})

describe('ReceiptsList', () => {
  it('affiche les reçus et le grand total', () => {
    render(<ReceiptsList fuelings={fuelings} />)
    expect(screen.getByText('CG 6377')).toBeInTheDocument()
    expect(screen.getByText('BH 8210')).toBeInTheDocument()
    expect(screen.getByText('285 200 FCFA')).toBeInTheDocument() // 185400 + 99800
  })
  it('filtre par statut payé', () => {
    render(<ReceiptsList fuelings={fuelings} />)
    fireEvent.change(screen.getByLabelText(/statut/i), { target: { value: 'paid' } })
    expect(screen.queryByText('CG 6377')).not.toBeInTheDocument()
    expect(screen.getByText('BH 8210')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

```bash
npx vitest run tests/history.test.tsx
```

Expected: FAIL — modules de composants introuvables.

- [ ] **Step 3: Implémenter PlanningsList**

Create `src/components/history/PlanningsList.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { Planning } from '@/lib/types'
import { Button } from '@/components/ui/Button'

export function PlanningsList({ plannings }: { plannings: Planning[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const sorted = [...plannings].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-2">
      {sorted.map((p) => (
        <div key={p.id} data-testid="planning-row" className="rounded-xl border border-gray-200 bg-white">
          <button
            className="flex w-full items-center justify-between px-4 py-3 text-left"
            onClick={() => setOpenId(openId === p.id ? null : p.id)}
          >
            <div>
              <div className="text-sm font-bold text-gray-900">{p.date}</div>
              <div className="text-xs text-gray-500">{p.source_label || 'Planning'} · {p.image_urls.length} photo(s)</div>
            </div>
            <span className="text-gray-400">{openId === p.id ? '−' : '+'}</span>
          </button>
          {openId === p.id ? (
            <div className="grid gap-2 border-t border-gray-100 px-4 py-3 sm:grid-cols-2">
              {p.image_urls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt={`Photo du planning ${p.date}`} className="rounded-lg border border-gray-200" />
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Implémenter ReceiptsList**

Create `src/components/history/ReceiptsList.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import type { Fueling } from '@/lib/types'
import { sumAmounts, formatFcfa } from '@/lib/fuel/calculations'
import { Select, EmptyState, Card } from '@/components/ui'

type Filter = 'all' | 'paid' | 'unpaid'

export function ReceiptsList({ fuelings }: { fuelings: Fueling[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    if (filter === 'paid') return fuelings.filter((f) => f.paid)
    if (filter === 'unpaid') return fuelings.filter((f) => !f.paid)
    return fuelings
  }, [fuelings, filter])

  const total = sumAmounts(filtered)
  const typeLabel = (t: string) => (t === 'diesel' ? 'Diesel' : 'Essence')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          id="statut"
          label="Statut"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          options={[
            { value: 'all', label: 'Tous' },
            { value: 'paid', label: 'Payés' },
            { value: 'unpaid', label: 'Non payés' },
          ]}
        />
        <Card className="flex-1 min-w-40">
          <p className="text-xs text-gray-500">Total affiché</p>
          <p data-testid="receipts-total" className="text-xl font-bold text-gray-900">{formatFcfa(total)}</p>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="Aucun reçu pour ces critères." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {filtered.map((f) => (
            <div key={f.id} data-testid="receipt-row" className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
              <div>
                <div className="text-sm font-semibold text-gray-900">{f.bus_number}</div>
                <div className="text-xs text-gray-500">
                  {f.date} · {typeLabel(f.fuel_type)} · {f.liters} L
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-gray-900">{formatFcfa(f.amount)}</span>
                <span className={`text-xs font-semibold ${f.paid ? 'text-green-600' : 'text-amber-600'}`}>
                  {f.paid ? 'Payé' : 'Non payé'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Créer les pages**

Create `src/app/(app)/historique/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import type { Planning } from '@/lib/types'
import { PlanningsList } from '@/components/history/PlanningsList'

export default async function HistoriquePage() {
  const supabase = await createClient()
  const { data } = await supabase.from('plannings').select('*').order('date', { ascending: false })
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Historique des plannings</h1>
      <PlanningsList plannings={(data ?? []) as Planning[]} />
    </div>
  )
}
```

Create `src/app/(app)/recus/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import type { Fueling } from '@/lib/types'
import { ReceiptsList } from '@/components/history/ReceiptsList'

export default async function RecusPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('fuelings').select('*').order('created_at', { ascending: false })
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Historique des reçus</h1>
      <ReceiptsList fuelings={(data ?? []) as Fueling[]} />
    </div>
  )
}
```

- [ ] **Step 6: Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run tests/history.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/historique src/app/\(app\)/recus src/components/history tests/history.test.tsx && git commit -m "feat: historique des plannings et des reçus"
```

---

### Task 12: Admin — prix carburant + gestion des utilisateurs

**Files:**
- Create: `src/app/(app)/admin/page.tsx`
- Create: `src/components/admin/PricesPanel.tsx`
- Create: `src/components/admin/UsersPanel.tsx`
- Create: `src/app/api/admin/users/route.ts`
- Test: `tests/prices-panel.test.tsx`

**Interfaces:**
- Consumes: `FuelPrice`, `Profile`, `latestPrice`, `formatFcfa`, `createClient()` navigateur/serveur.
- Produces: route `/admin` (onglets Prix / Utilisateurs), route API `POST /api/admin/users` (création d'utilisateur par l'admin via clé de service).

- [ ] **Step 1: Écrire le test du panneau prix (échoue)**

Create `tests/prices-panel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PricesPanel } from '@/components/admin/PricesPanel'
import type { FuelPrice } from '@/lib/types'

const prices: FuelPrice[] = [
  { id: '1', fuel_type: 'diesel', price: 618, effective_date: '2026-08-01', created_by: null, created_at: '' },
  { id: '2', fuel_type: 'essence', price: 499, effective_date: '2026-08-01', created_by: null, created_at: '' },
]

const mockInsert = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) =>
      table === 'fuel_prices'
        ? { insert: mockInsert, select: () => ({ order: () => Promise.resolve({ data: prices }) }) }
        : { select: () => ({ order: () => Promise.resolve({ data: [] }) }) },
  }),
}))

describe('PricesPanel', () => {
  it('affiche les prix actuels essence et diesel', () => {
    render(<PricesPanel initialPrices={prices} />)
    expect(screen.getByText('618 FCFA')).toBeInTheDocument()
    expect(screen.getByText('499 FCFA')).toBeInTheDocument()
  })

  it('enregistre un nouveau prix', async () => {
    mockInsert.mockResolvedValue({ error: null })
    render(<PricesPanel initialPrices={prices} />)
    fireEvent.change(screen.getByLabelText(/type de carburant/i), { target: { value: 'diesel' } })
    fireEvent.change(screen.getByLabelText(/prix du litre/i), { target: { value: '650' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le prix/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    expect(mockInsert.mock.calls[0][0]).toMatchObject({ fuel_type: 'diesel', price: 650 })
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

```bash
npx vitest run tests/prices-panel.test.tsx
```

Expected: FAIL — module `@/components/admin/PricesPanel` introuvable.

- [ ] **Step 3: Implémenter PricesPanel**

Create `src/components/admin/PricesPanel.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FuelPrice, FuelType } from '@/lib/types'
import { formatFcfa, todayLocalISO } from '@/lib/fuel/calculations'
import { Button, Input, Select, Card } from '@/components/ui'

interface Props {
  initialPrices: FuelPrice[]
}

export function PricesPanel({ initialPrices }: Props) {
  const supabase = createClient()
  const [prices, setPrices] = useState<FuelPrice[]>(initialPrices)
  const [type, setType] = useState<FuelType>('diesel')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const { data } = await supabase.from('fuel_prices').select('*').order('effective_date')
    setPrices((data ?? []) as FuelPrice[])
  }

  useEffect(() => {
    refresh()
  }, [])

  const current = (t: FuelType) => {
    const candidates = prices.filter((p) => p.fuel_type === t)
    if (candidates.length === 0) return null
    return candidates.reduce((a, b) => (a.effective_date > b.effective_date ? a : b))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const p = Number(price)
    if (!p || p <= 0) {
      setError('Saisissez un prix valide.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('fuel_prices').insert({
      fuel_type: type,
      price: p,
      effective_date: todayLocalISO(),
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setPrice('')
    await refresh()
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-xs text-gray-500">Diesel actuel</p>
          <p className="text-xl font-bold text-gray-900">{current('diesel') ? formatFcfa(current('diesel')!.price) : '—'}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Essence actuelle</p>
          <p className="text-xl font-bold text-gray-900">{current('essence') ? formatFcfa(current('essence')!.price) : '—'}</p>
        </Card>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-base font-bold text-gray-900">Changer un prix</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            id="type"
            label="Type de carburant"
            value={type}
            onChange={(e) => setType(e.target.value as FuelType)}
            options={[
              { value: 'diesel', label: 'Diesel' },
              { value: 'essence', label: 'Essence' },
            ]}
          />
          <Input id="prix" label="Prix du litre (FCFA)" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? '…' : 'Enregistrer le prix'}
            </Button>
          </div>
        </div>
        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      </form>

      <Card title="Historique des prix">
        <ul className="divide-y divide-gray-100 text-sm">
          {prices.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span className="text-gray-700 capitalize">{p.fuel_type} · {p.effective_date}</span>
              <span className="font-semibold text-gray-900">{formatFcfa(p.price)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run tests/prices-panel.test.tsx
```

Expected: 2 tests PASS.

- [ ] **Step 5: Implémenter UsersPanel**

Create `src/components/admin/UsersPanel.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Role } from '@/lib/types'
import { Button, Input, Select } from '@/components/ui'

interface Props {
  initialProfiles: Profile[]
}

export function UsersPanel({ initialProfiles }: Props) {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)

  async function refresh() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles((data ?? []) as Profile[])
  }

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('achat')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const roleLabel = (r: Role) => (r === 'admin' ? 'Administrateur' : 'Service achat')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName, role }),
    })
    setBusy(false)
    const body = await res.json()
    if (!res.ok) {
      setError(body.error ?? 'Erreur lors de la création.')
      return
    }
    setEmail(''); setPassword(''); setFullName('')
    await refresh()
  }

  async function changeRole(id: string, next: Role) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role: next }),
    })
    if (res.ok) await refresh()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-base font-bold text-gray-900">Créer un utilisateur</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input id="u-name" label="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Input id="u-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input id="u-pass" label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <Select
            id="u-role"
            label="Rôle"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            options={[
              { value: 'achat', label: 'Service achat' },
              { value: 'admin', label: 'Administrateur' },
            ]}
          />
        </div>
        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Création…' : 'Créer l’utilisateur'}
        </Button>
      </form>

      <Card title="Utilisateurs">
        <ul className="divide-y divide-gray-100 text-sm">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <div className="font-semibold text-gray-900">{p.full_name || '—'}</div>
                <div className="text-xs text-gray-500">{roleLabel(p.role)}</div>
              </div>
              <Select
                id={`role-${p.id}`}
                aria-label={`Rôle de ${p.full_name}`}
                value={p.role}
                onChange={(e) => changeRole(p.id, e.target.value as Role)}
                options={[
                  { value: 'achat', label: 'Service achat' },
                  { value: 'admin', label: 'Administrateur' },
                ]}
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
```

- [ ] **Step 6: Implémenter la route API admin (création + changement de rôle)**

Create `src/app/api/admin/users/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/types'

function serviceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'non authentifié' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'interdit' }, { status: 403 }) }
  return { error: null }
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const body = await req.json()
  const { email, password, full_name, role } = body as {
    email: string
    password: string
    full_name?: string
    role?: Role
  }

  const admin = serviceClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name ?? '' },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (role && role !== 'achat') {
    await admin.from('profiles').update({ role }).eq('id', data.user.id)
  }
  return NextResponse.json({ ok: true, id: data.user.id })
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const body = await req.json()
  const { id, role } = body as { id: string; role: Role }
  const admin = serviceClient()
  const { error } = await admin.from('profiles').update({ role }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Créer la page admin**

Create `src/app/(app)/admin/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import type { FuelPrice, Profile } from '@/lib/types'
import { PricesPanel } from '@/components/admin/PricesPanel'
import { UsersPanel } from '@/components/admin/UsersPanel'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .single()

  if (profile?.role !== 'admin') {
    return <p className="text-sm text-red-600">Accès réservé à l'administrateur.</p>
  }

  const [{ data: prices }, { data: profiles }] = await Promise.all([
    supabase.from('fuel_prices').select('*').order('effective_date'),
    supabase.from('profiles').select('*').order('full_name'),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Prix du carburant</h2>
        <PricesPanel initialPrices={(prices ?? []) as FuelPrice[]} />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Utilisateurs</h2>
        <UsersPanel initialProfiles={(profiles ?? []) as Profile[]} />
      </section>
    </div>
  )
}
```

- [ ] **Step 8: Vérifier build**

```bash
npx vitest run tests/prices-panel.test.tsx && npm run build
```

Expected: tests PASS, build OK.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/admin src/app/api/admin src/components/admin tests/prices-panel.test.tsx && git commit -m "feat: admin prix carburant et gestion des utilisateurs"
```

---

### Task 13: Polissage — metadata, README, vérification finale

**Files:**
- Create: `README.md`
- Modify: `src/app/layout.tsx` (titre, langue française, metadata)

**Interfaces:**
- Consumes: tout.
- Produces: application complète et vérifiable, documentation de déploiement.

- [ ] **Step 1: Mettre à jour la metadata racine**

Modify `src/app/layout.tsx` :

```tsx
export const metadata = {
  title: 'Service d'achat — Transport',
  description: 'Gestion des départs et des pleins de carburant des bus',
}
```

- [ ] **Step 2: Écrire le README**

Create `README.md` :

```md
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
```

- [ ] **Step 3: Vérification finale complète**

```bash
npm test
npm run build
```

Expected: tous les tests PASS, build OK.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: polissage, README et documentation"
```

---

## Déploiement (manuel, hors code)

1. Créer le projet Supabase, appliquer la migration, créer le bucket `plannings` (public).
2. Créer le premier compte via Supabase Auth (Users > Add user), régler son rôle à `admin` dans la table `profiles`.
3. Déployer sur Vercel depuis le dépôt GitHub, renseigner `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Se connecter, créer les autres utilisateurs depuis l'écran Admin.
