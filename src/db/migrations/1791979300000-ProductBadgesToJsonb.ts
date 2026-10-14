import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * products.badges: enum[] (badge keys)  ->  jsonb (array of badges.id)
 * Hand-written on purpose: migration:generate would drop/re-add the column and lose data.
 */
export class ProductBadgesToJsonb1791979300000 implements MigrationInterface {
  name = 'ProductBadgesToJsonb1791979300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Seed the six legacy enum values so every existing product badge has a row to point at.
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

    // 2. ALTER ... TYPE ... USING cannot contain a subquery, so go through a temp column.
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
