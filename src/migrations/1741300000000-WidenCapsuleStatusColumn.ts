import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Widen capsules.status from varchar(15) to varchar(20)
 *
 * The GENERATING_ASSETS status value is 17 characters, which exceeds
 * the original varchar(15) constraint.
 */
export class WidenCapsuleStatusColumn1741300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "capsules" ALTER COLUMN "status" TYPE varchar(20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "capsules" ALTER COLUMN "status" TYPE varchar(15)`,
    );
  }
}
