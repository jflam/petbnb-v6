# Sitter Discovery & Search – Implementation Plan (MVP-1)

> This plan supersedes the fortune-cookie demo and introduces the real PetBnB data model, API surface, and client UI.  
> “Fortune” tables, seed scripts, and endpoints will be deleted once the new stack is in place.

---

## 1 • Data Model (PostgreSQL + Prisma)

### Tables / Relations
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | `id PK`, `role ENUM('owner','sitter')`, `email`, `password_hash`, `created_at` | Shared auth table. |
| `sitters` | `id PK`, `user_id FK`, `bio`, `rate_boarding`, `rate_daycare`, `response_time_mins`, `repeat_client_pct`, `radius_km`, `address_geom GEOGRAPHY(POINT,4326)` | 1-to-1 with `users`. |
| `sitter_services` | `sitter_id FK`, `service ENUM`, `price_cents` | For future service expansion. |
| `reviews` | `id PK`, `sitter_id FK`, `owner_id FK`, `rating INT`, `comment`, `created_at` | Avg rating derived view. |
| `pets` | `id PK`, `owner_id FK`, `name`, `type ENUM('dog','cat')`, `size ENUM('XS','S','M','L','XL')`, `special_needs JSONB` | `special_needs` array → `['medication','senior']`. |
| `availability` | `sitter_id FK`, `date DATE`, `is_available BOOL` | Simple POC; later replace with range model. |

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

---

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

---

## 3 • API Design (Express + Prisma)

| Route | Method | Query / Body | Description |
|-------|--------|-------------|-------------|
| `/api/sitters/search` | GET | `lat,lng,start,end,petSize,needs[],sort,page=1` | Returns `{ results, total, paging, bbox }`. |
| `/api/sitters/:id` | GET | – | Detailed sitter profile. |

### Search Handler Flow
1. Validate+parse query with `zod`.
2. Build Prisma query:
   * `ST_DWithin(address_geom, POINT(lng lat), radius)` via raw SQL.
   * JOIN `vw_sitter_rating`.
   * Filter by `petSize`, `special_needs` JSON containment.
3. Apply ranking weights (distance, rating, etc.) in SQL CTE for performance.
4. Paginate (50 per page).
5. Return GeoJSON FeatureCollection for easy map rendering.

---

## 4 • Client UI (React + Vite + Leaflet)

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
* `<ResultsMap>` – Leaflet map with:
  * Numbered markers matching list order.
  * `MarkerClusterGroup`.
  * Sticky “Search this area” button.
  * Heatmap overlay when count > 200.
* `<Pagination>` – infinite scroll for list view.

### State Management
* URL-driven state via `useSearchParams`.  
* React Query for API fetching + caching.  
* Zustand (lightweight) for local UI state (filter drawer open, view mode).

---

## 5 • Decommission Fortune Demo

* Delete `/server/src/db.ts`, fortunes migrations, seeds, Prisma model `Fortune`, `/client` fortune calls, Docker seeding logic.
* Update Docker Compose & infra Bicep secrets to reference new `PETBNB_…` names as needed.

---

## 6 • Logging & Telemetry

* Replace `console.log('🪄 Fortune API…')` with `logger.info('[SitterSearch] …')` using `pino`.
* Emit custom App Insights events `search_performed`, `map_viewport_changed`, `filter_applied`, etc.

---

## 7 • Incremental Delivery Plan

| Sprint | Milestone |
|--------|-----------|
| 1 | DB schema & seed script, `/api/sitters/search` returning stub data. |
| 2 | React list view with filters (no map). |
| 3 | Leaflet map view + toggle + numbered markers. |
| 4 | Ranking weights, clustering, “Search this area”. |
| 5 | Clean-up: delete fortune code, update CI/CD, load tests. |

---

_Revision date: $(date +%Y-%m-%d)_
