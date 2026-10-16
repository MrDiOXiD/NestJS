import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderTrackingCode1792170000000 implements MigrationInterface {
  name = 'AddOrderTrackingCode1792170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "trackingCode" character varying(50)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN IF EXISTS "trackingCode"`);
  }
}
