import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBadgesTable1791979200000 implements MigrationInterface {
  name = 'CreateBadgesTable1791979200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "badges"`);
  }
}
