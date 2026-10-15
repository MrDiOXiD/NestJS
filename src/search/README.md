# Product Search module (NestJS + TypeORM + Postgres)

Tested against PostgreSQL 16 with 200k synthetic Persian/English products.

## Install
1. Copy `src/search/` into your NestJS `src/`.
2. Check the `BadgeEntity` import at the top of `search.service.ts` (`@/badges/entities/badge.entity`) matches your path.
3. Register the migration in your TypeORM config, then run it:
   `npm run typeorm migration:run` (it creates the `pg_trgm` extension — needs a DB user that may do that)
4. Add `SearchModule` to `AppModule.imports`.
5. Make sure `ValidationPipe({ transform: true })` is enabled globally (needed for query DTO parsing).

## Endpoints
| Endpoint | Purpose |
|---|---|
| `GET /search/products` | text + filters + sort + pagination |
| `GET /search/facets`   | sidebar counts for the SAME params (cached 60s). Call in parallel with `/products` |
| `GET /search/suggest?q=` | search-bar autocomplete (products + brands) |

Params: `q, categoryIds=1,2, brands=a,b, badgeIds=1,3, minPrice, maxPrice (final price after active discount), inStock, onDiscount, attr[color]=white&attr[power]=9W,12W, sort=relevance|newest|price_asc|price_desc|featured|discount, page, limit`

`attr[...]` needs Express's default query parser (qs). With Fastify, enable `querystringParser: qs.parse`.

## How it works
* `fa_normalize()` (SQL, mirrored in `utils/normalize.ts`): ي→ی, ك→ک, Arabic/Persian digits→0-9, ZWNJ→space, strips harakat.
* `search_vector` (weighted tsvector: title A, brand B, description C, attributes D) + GIN index → fast word/prefix search.
* `search_text` + `pg_trgm` GIN index → substring search and typo tolerance.
* Typo tolerance is a *fallback*: only used if exact matching returns < 5 products (`FUZZY_FALLBACK_BELOW`).
* Facets exclude their own dimension, so picking a brand doesn't hide the other brands.

## Tuning (top of `search.service.ts`)
`WORD_SIMILARITY` (lower = more typo tolerant), `FUZZY_FALLBACK_BELOW`, `FACET_CACHE_TTL_MS`.

## Caveats
* The two generated columns and the extra indexes are not in your entity. If you use `typeorm migration:generate`, review its output — it may try to drop them.
* Facet cache is in-process memory. With several app instances, swap for Redis / `@nestjs/cache-manager`.
* Category facets return ids + counts; join your categories table in the frontend (or add a join) to show names.
* Postgres has no Persian stemmer: matching is by normalised word/prefix/trigram. That works well for product names; if you later need synonyms (e.g. «لپ تاپ» = «لپتاپ» = laptop) or semantic search, that's the point to add Meilisearch / Elasticsearch.
* Adding the generated columns rewrites the `products` table once (~20 s for 200k rows) and locks it meanwhile — run off-peak.
