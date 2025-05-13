# Sitter Discovery & Search – Implementation Plan (MVP-1)

> This plan supersedes the fortune-cookie demo and introduces the real PetBnB data model, API surface, and client UI.\
> “Fortune” tables, seed scripts, and endpoints will be deleted once the new stack is in place.

***

## 1 • Data Model (PostgreSQL + Prisma)

Make sure to install appropriate PostgreSQL extensions for handling GEOGRAPHY
data types.

### Tables / Relations

| Table             | Key Columns                                                                                                                                                 | Notes                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `users`           | `id PK`, `role ENUM('owner','sitter')`, `email`, `password_hash`, `created_at`                                                                              | Shared auth table.                                 |
| `sitters`         | `id PK`, `user_id FK`, `bio`, `rate_boarding`, `rate_daycare`, `response_time_mins`, `repeat_client_pct`, `radius_km`, `address_geom GEOGRAPHY(POINT,4326)` | 1-to-1 with `users`.                               |
| `sitter_services` | `sitter_id FK`, `service ENUM`, `price_cents`                                                                                                               | For future service expansion.                      |
| `reviews`         | `id PK`, `sitter_id FK`, `owner_id FK`, `rating INT`, `comment`, `created_at`                                                                               | Avg rating derived view.                           |
| `pets`            | `id PK`, `owner_id FK`, `name`, `type ENUM('dog','cat')`, `size ENUM('XS','S','M','L','XL')`, `special_needs JSONB`                                         | `special_needs` array → `['medication','senior']`. |
| `availability`    | `sitter_id FK`, `date DATE`, `is_available BOOL`                                                                                                            | Simple POC; later replace with range model.        |

#### Materialised Views / Indices

* `vw_sitter_rating` – AVG(rating), COUNT(reviews) per sitter.
* GiST index on `address_geom` for fast `ST_DWithin` proximity search.
* Composite index on `(service, price_cents)` for sort/filter.

#### Prisma schema stub

```prisma
model Sitter {
  id            Int      @id @default(autoincrement())
  user          User     @relation(fields: [userId], references: [id])
  userId        Int
  bio           String?
  rateBoarding  Int?
  rateDaycare   Int?
  responseTime  Int?
  repeatClient  Int?
  radiusKm      Int      @default(8)
  addressGeom   Bytes    @db.Geography
  reviews       Review[]
  availability  Availability[]
}
```

***

## 2 • Seed Strategy (`server/prisma/seed.ts`)

1. **Purge** former fortune seeds.
2. Insert 10 demo sitters:
   * Random lat/long within Seattle and Austin Texas metro areas, 5 in each (`faker-js@8`).
   * Generate image generation prompt for each sitter that is suitable for
     generating a Studio Ghibli image for the sitter using the OpenAI
     gpt-image-1 model. Write a script that will call the gpt-image-1 model
     using those prompts to generate images for the sitters. Make sure that
     those generated images are placed in a public web folder and that the
     generated UI code retrieves those images from that public web folder for
     the front end piece for the appropriate sitter.
   * Rates: \$30–\$80 (boarding) / \$20–\$50 (day care).
   * Random response time (15 – 120 mins) & repeat-client % (0–80).
   * Availability generated for the next 60 days.
3. Insert 10 demo owners + 25 pets of varied sizes & needs.
4. Insert 200 random reviews (rating 1–5) to build averages.

***

## 3 • API Design (Express + Prisma)

| Route                 | Method | Query / Body                                    | Description                                 |
| --------------------- | ------ | ----------------------------------------------- | ------------------------------------------- |
| `/api/sitters/search` | GET    | `lat,lng,start,end,petSize,needs[],sort,page=1` | Returns `{ results, total, paging, bbox }`. |
| `/api/sitters/:id`    | GET    | –                                               | Detailed sitter profile.                    |

### Search Handler Flow

1. Validate+parse query with `zod`.
2. Build Prisma query:
   * `ST_DWithin(address_geom, POINT(lng lat), radius)` via raw SQL.
   * JOIN `vw_sitter_rating`.
   * Filter by `petSize`, `special_needs` JSON containment.
3. Apply ranking weights (distance, rating, etc.) in SQL CTE for performance.
4. Paginate (50 per page).
5. Return GeoJSON FeatureCollection for easy map rendering.

***

## 4 • Client UI (React + Vite)

### Top-level Pages

```
/search        – List/Map toggle, filters sidebar.
/sitter/:id    – Profile detail (out-of-scope for MVP-1).
```

### Components

* `<SearchBar>` – location + date picker (react-day-picker).
* `<FiltersDrawer>` – pet size chips, special-needs checkboxes, price range slider, home features toggles.
* `<ViewToggle>` – switches list ↔ map (Material UISwitch).
* `<SitterCard>` – hero image, name, ★ rating + review count tooltip, response-time badge, repeat-client badge, price chips.
* `<ResultsList>` – virtualised list (react-window).
* `<Pagination>` – infinite scroll for list view.

### State Management

* URL-driven state via `useSearchParams`.
* React Query for API fetching + caching.
* Zustand (lightweight) for local UI state (filter drawer open, view mode).

***

## 5 • Decommission Fortune Demo

* Delete `/server/src/db.ts`, fortunes migrations, seeds, Prisma model `Fortune`, `/client` fortune calls, Docker seeding logic.
* Update Docker Compose & infra Bicep secrets to reference new `PETBNB_…` names as needed.

***

## 6 • Logging & Telemetry

* Replace `console.log('🪄 Fortune API…')` with `logger.info('[SitterSearch] …')` using `pino`.
* Emit custom App Insights events `search_performed`, `map_viewport_changed`, `filter_applied`, etc.

---

## 7 • Smoke Tests (⌘-curl)

> Run these locally (Container App port 4000) or against the deployed URL.  
> All commands must exit **0** and return the expected JSON shape.

```bash
# 1 • API Liveness
curl -fsSL http://localhost:4000/api/health | jq -e '.status=="ok"'

# 2 • Basic Sitter Search (returns ≥1 demo sitter)
curl -fsSL \
  "http://localhost:4000/api/sitters/search?lat=47.6097&lng=-122.3331&start=$(date -I)&end=$(date -I -d '+2 days')&page=1" \
  | jq -e '.results | length > 0 and .[0] | has("id","name","distanceMi")'

# 3 • Fetch First Sitter Profile
export FIRST_ID=$(curl -s \
  "http://localhost:4000/api/sitters/search?lat=47.6097&lng=-122.3331&start=$(date -I)&end=$(date -I -d '+2 days')" \
  | jq -r '.results[0].id')
curl -fsSL "http://localhost:4000/api/sitters/${FIRST_ID}" | jq -e 'has("id","bio","services")'
```

These three checks validate:  
1) the server is running,  
2) search endpoint returns data,  
3) profile endpoint resolves for a given sitter.  
They serve as the minimum E2E gate in CI/CD.

***

## 8 • Outstanding Issues Before Implementation  — **RESOLVED**

Below each former issue you will find the **resolution** (▶︎ **Answer**) or the chosen **action item** (✔︎ **Do this**) that clears the blocker.

---

### 1. Data Model

• **Prisma mapping for `GEOGRAPHY(POINT,4326)`**
▶︎ **Answer** – Prisma ORM (v5.14, April 2025) still exposes PostGIS columns as `Unsupported("geography(Point,4326)")`. Use that in the schema **instead of** `Bytes @db.Geography`, e.g.

```prisma
addressGeom Unsupported("geography(Point,4326)")
```

Add the `postgis` extension in the `datasource` block and enable the `postgresqlExtensions` preview‑feature. Spatial queries will be executed with `db.$queryRaw` wrappers. ([prisma.io](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/safeql?utm_source=chatgpt.com))

• **`availability` single‑day rows vs. date‑range queries**
▶︎ **Answer** – keep the simple per‑day rows for the MVP and satisfy range queries with `WHERE date BETWEEN $start AND $end` plus a `HAVING COUNT(*) = $nDays` aggregation to ensure full coverage. (Switching to `daterange` + GiST index can be a later optimisation.)

• **Undefined `sitter_services.service` values**
✔︎ **Do this** – lock the ENUM to: `('boarding','daycare','walking','house_sitting','drop_in')` so we can price future add‑ons without another migration.

• **View & index migration scripts**
✔︎ **Do this** – add a raw SQL migration file under `prisma/migrations/**/init_spatial.sql` that:
  1. `CREATE EXTENSION IF NOT EXISTS postgis;`
  2. creates the `vw_sitter_rating` materialised view, the GiST index on `address_geom`, and the composite `(service,price_cents)` B‑tree index.

---

### 2. Seed Strategy

• **`gpt-image-1` model availability & auth**
▶︎ **Answer** – `gpt-image-1` is GA on the public OpenAI API (since Apr 23 2025) but *not yet* on Azure. Use the OpenAI endpoint with your existing org key; wrap calls in a tiny rate‑limiter and allow falling back to `dall‑e‑3` if a 404 model‑not‑found error is returned. ([openai.com](https://openai.com/index/image-generation-api/?utm_source=chatgpt.com))

• **Public image folder & CDN**
✔︎ **Do this** – store files as `/public/sitters/{sitterId}.jpg`, fronted by the existing static Edge CDN path `/assets/sitters/{id}.jpg` with a 30‑day immutable cache‑control header.

• **Faker bounding boxes**
✔︎ **Do this** – constrain coordinates:

* **Seattle** lat `47.49–47.78`, lng `‑122.46 – ‑122.22`
* **Austin** lat `30.19–30.52`, lng `‑97.94 – ‑97.56`
  to avoid water/desert placements.

---

### 3. API Design

• **`petSize` / `needs[]` join path**
▶︎ **Answer** – expose two *optional* query params `petSize` & `needs[]`. Filter sitters via a lateral sub‑query that checks **any** pet owned by the current requester: 

```sql
WHERE EXISTS (
  SELECT 1 FROM pets p
  WHERE p.owner_id = $ownerId
    AND p.size = $petSize
    AND $needs <@ p.special_needs
)
```

This avoids introducing capability columns on `sitters` for the MVP.

• **Pagination size param**
✔︎ **Do this** – accept `pageSize` (max 100, default 50). Document in the route table.

• **Response shape mismatch**
▶︎ **Answer** – keep the GeoJSON FeatureCollection (easier for the map) **and** add a convenience array `results` containing `{id,name,distanceMi}` for the list view; update smoke tests to inspect `results[0]`.

• **Missing `services` relation on `/sitters/:id`**
✔︎ **Do this** – add in Prisma:

```prisma
model SitterService {
  sitter     Sitter   @relation(fields:[sitterId],references:[id])
  sitterId   Int
  service    Service  // enum defined above
  priceCents Int
  @@id([sitterId,service])
}

enum Service {
  boarding
  daycare
  walking
  house_sitting
  drop_in
}

model Sitter {
  ...
  services SitterService[]
}
```

Adjust smoke test to expect `services` array.

---

### 4. Client UI

• **Map CRS & tiles**
▶︎ **Answer** – stick with **EPSG:4326** from the API and re‑project client‑side to Web Mercator automatically handled by **MapLibre GL JS** with free OpenStreetMap tiles via `https://{a–c}.tile.openstreetmap.org/{z}/{x}/{y}.png` (no API key), leaving room to swap in commercial tiles later.

---

### 5. Decommission Fortune Demo

✔︎ **Do this** – insert a blocking step in the GitHub Actions workflow: migrate new schema **first**, then run the seed job to avoid legacy seeders touching dropped tables.

---

### 6. Logging & Telemetry

✔︎ **Do this** – add `APPINSIGHTS_CONNECTION_STRING` to Bicep and GitHub secrets; inject via container ENV and initialise Pino with `pino‑app‑insights` transport.

---

### 7. Smoke Tests

• **`jq has()` fix**
▶︎ **Answer** – replace with: `jq -e '.["results"] | length > 0 and .[0] | (has("id") and has("name") and has("distanceMi"))'`.

• **Uniform curl flags**
✔︎ **Do this** – replace all `curl -fsSL` with `curl --silent --fail --show-error --location` for readable CI logs.

---

**All blockers have been either answered or converted into explicit follow‑up action items. The MVP is now unblocked for implementation.**




