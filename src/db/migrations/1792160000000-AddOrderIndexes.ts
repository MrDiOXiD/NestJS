import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for the paginated admin order list. Names match the @Index decorators on the entities,
 * so `migration:generate` will not try to drop or re-create them.
 *
 * Not indexed on purpose: paymentMethod / paidAt (only 2-3 distinct values, a btree barely helps)
 * and the ILIKE search (a plain btree cannot serve '%text%'; pg_trgm would, if search ever gets slow).
 */
export class AddOrderIndexes1792160000000 implements MigrationInterface {
  name = 'AddOrderIndexes1792160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_status_orderAt" ON "order" ("status", "orderAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_orderAt" ON "order" ("orderAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_userId" ON "order" ("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_product_orderId" ON "orders-product" ("orderId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_product_orderId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_orderAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_status_orderAt"`);
  }
}
