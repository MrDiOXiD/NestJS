import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Postgres-native search layer for `products`:
 *  - pg_trgm            -> typo tolerance, substring + "starts with" matching
 *  - fa_normalize()     -> Persian/Arabic char + digit normalisation (mirrors utils/normalize.ts)
 *  - search_vector      -> weighted full-text vector (title A, brand B, description C, attributes D)
 *  - search_text        -> normalised title + brand for trigram matching
 *  - GIN / partial btree indexes for every filter we expose
 *
 * Both search columns are GENERATED ... STORED, so they stay in sync automatically.
 * Adding them rewrites the table once (fast up to a few hundred thousand rows).
 */
export class AddProductSearch1760600000000 implements MigrationInterface {
  name = 'AddProductSearch1760600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await q.query(`
      CREATE OR REPLACE FUNCTION fa_normalize(t text) RETURNS text
      LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $fn$
        SELECT btrim(regexp_replace(
          regexp_replace(
            lower(translate(coalesce(t, ''),
              'يىكۀةأإآ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹' || chr(8204),
              'ییکههاااا01234567890123456789' || ' ')),
            '[\\u064B-\\u065F\\u0670\\u0640]', '', 'g'),
          '\\s+', ' ', 'g'))
      $fn$
    `);

    await q.query(`
      ALTER TABLE "products"
        ADD COLUMN "search_text" text GENERATED ALWAYS AS (
          fa_normalize("title" || ' ' || coalesce("brand", ''))
        ) STORED,
        ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
          setweight(to_tsvector('simple', fa_normalize("title")), 'A') ||
          setweight(to_tsvector('simple', fa_normalize(coalesce("brand", ''))), 'B') ||
          setweight(to_tsvector('simple', fa_normalize(coalesce("description", ''))), 'C') ||
          setweight(jsonb_to_tsvector('simple', coalesce("attributes", '{}'::jsonb), '["string","numeric"]'), 'D')
        ) STORED
    `);

    // text search
    await q.query(`CREATE INDEX "IDX_products_search_vector" ON "products" USING gin ("search_vector")`);
    await q.query(`CREATE INDEX "IDX_products_search_text_trgm" ON "products" USING gin ("search_text" gin_trgm_ops)`);

    // filters (partial: storefront only ever queries active products)
    await q.query(`CREATE INDEX "IDX_products_active_category_price" ON "products" ("categoryId", "price") WHERE "isActive" = true`);
    await q.query(`CREATE INDEX "IDX_products_active_brand" ON "products" ("brand") WHERE "isActive" = true`);
    await q.query(`CREATE INDEX "IDX_products_active_created" ON "products" ("createdAt") WHERE "isActive" = true`);
    await q.query(`CREATE INDEX "IDX_products_attributes_gin" ON "products" USING gin ("attributes" jsonb_path_ops)`);
    await q.query(`CREATE INDEX "IDX_products_badges_gin" ON "products" USING gin ("badges" jsonb_path_ops)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const idx of [
      'IDX_products_badges_gin', 'IDX_products_attributes_gin', 'IDX_products_active_created',
      'IDX_products_active_brand', 'IDX_products_active_category_price',
      'IDX_products_search_text_trgm', 'IDX_products_search_vector',
    ]) await q.query(`DROP INDEX IF EXISTS "${idx}"`);
    await q.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "search_vector", DROP COLUMN IF EXISTS "search_text"`);
    await q.query(`DROP FUNCTION IF EXISTS fa_normalize(text)`);
  }
}
