import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * products.badges: enum[] (badge keys)  ->  jsonb (array of badges.id)
 *
 * Self-contained and idempotent: it works whether or not CreateBadgesTable ran first,
 * and whether the database is fresh, legacy (enum column) or already converted.
 * Hand-written on purpose: migration:generate would drop/re-add the column and lose data.
 */
export class ProductBadgesToJsonb1791979300000 implements MigrationInterface {
  name = 'ProductBadgesToJsonb1791979300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const products = await queryRunner.getTable('products');

    // Fresh database: no products table yet, the schema is created elsewhere (initial migration / synchronize).
    if (!products) return;

    const column = products.findColumnByName('badges');

    if (!column) {
      await queryRunner.query(`ALTER TABLE "products" ADD "badges" jsonb`);
      return;
    }

    // Already converted (e.g. synchronize created it from the current entity).
    if (column.type === 'jsonb') return;

    // ── Legacy enum[] column: convert it ─────────────────────────────────────────

    // 1. The badges table must exist even if CreateBadgesTable never ran on this database.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "badges" (
        "id" SERIAL NOT NULL,
        "key" character varying(30) NOT NULL,
        "label" character varying(50) NOT NULL,
        "color" character varying(7) NOT NULL DEFAULT '#2563EB',
        "textColor" character varying(7) NOT NULL DEFAULT '#FFFFFF',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_badges_key" UNIQUE ("key"),
        CONSTRAINT "PK_badges_id" PRIMARY KEY ("id")
      )
    `);

    // 2. Seed the six legacy enum values so every existing product badge has a row to point at.
    await queryRunner.query(`
      INSERT INTO "badges" ("key", "label", "color") VALUES
        ('new',        'جدید',     '#2563EB'),
        ('hot',        'داغ',      '#DC2626'),
        ('sale',       'حراج',     '#16A34A'),
        ('bestseller', 'پرفروش',   '#F59E0B'),
        ('limited',    'محدود',    '#7C3AED'),
        ('trending',   'پرطرفدار', '#DB2777')
      ON CONFLICT ("key") DO NOTHING
    `);

    // 3. ALTER ... TYPE ... USING cannot contain a subquery, so go through a temp column.
    await queryRunner.query(`ALTER TABLE "products" ADD "badges_new" jsonb`);
    await queryRunner.query(`
      UPDATE "products" p
      SET "badges_new" = COALESCE((
        SELECT jsonb_agg(b."id" ORDER BY u.ord)
        FROM unnest(p."badges"::text[]) WITH ORDINALITY AS u(key, ord)
        JOIN "badges" b ON b."key" = u.key
      ), '[]'::jsonb)
      WHERE p."badges" IS NOT NULL
    `);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "badges"`);
    await queryRunner.query(`ALTER TABLE "products" RENAME COLUMN "badges_new" TO "badges"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "products_badges_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "products_badges_enum" AS ENUM('new','hot','sale','bestseller','limited','trending')`,
    );
    await queryRunner.query(`ALTER TABLE "products" ADD "badges_old" "products_badges_enum"[]`);
    // Only badges whose key is one of the legacy enum values can be restored.
    await queryRunner.query(`
      UPDATE "products" p
      SET "badges_old" = (
        SELECT array_agg(b."key"::"products_badges_enum" ORDER BY u.ord)
        FROM jsonb_array_elements_text(p."badges") WITH ORDINALITY AS u(id, ord)
        JOIN "badges" b ON b."id" = u.id::int
        WHERE b."key" IN ('new','hot','sale','bestseller','limited','trending')
      )
      WHERE p."badges" IS NOT NULL
    `);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "badges"`);
    await queryRunner.query(`ALTER TABLE "products" RENAME COLUMN "badges_old" TO "badges"`);
  }
}
