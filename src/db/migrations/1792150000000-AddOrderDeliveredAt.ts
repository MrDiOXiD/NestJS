import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderDeliveredAt1792150000000 implements MigrationInterface {
  name = 'AddOrderDeliveredAt1792150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP`);

    // Until now delivering an order overwrote "orderAt", so for already-delivered orders that column
    // holds the delivery time. Keep it as deliveredAt. (The original order date of those rows is gone.)
    await queryRunner.query(`
      UPDATE "order" SET "deliveredAt" = "orderAt"
      WHERE "status" = 'delivered' AND "deliveredAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN IF EXISTS "deliveredAt"`);
  }
}
