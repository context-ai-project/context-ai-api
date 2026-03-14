import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Fix chk_capsules_status to allow GENERATING_ASSETS and RENDERING.
 *
 * The original constraint allowed 'GENERATING' but the application uses
 * CapsuleStatus.GENERATING_ASSETS and CapsuleStatus.RENDERING.
 */
export class FixCapsuleStatusCheckConstraint1741400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "capsules" DROP CONSTRAINT IF EXISTS "chk_capsules_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "capsules"
       ADD CONSTRAINT "chk_capsules_status"
       CHECK (status IN ('DRAFT', 'GENERATING_ASSETS', 'RENDERING', 'COMPLETED', 'ACTIVE', 'FAILED', 'ARCHIVED'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "capsules" DROP CONSTRAINT IF EXISTS "chk_capsules_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "capsules"
       ADD CONSTRAINT "chk_capsules_status"
       CHECK (status IN ('DRAFT', 'GENERATING', 'COMPLETED', 'ACTIVE', 'FAILED', 'ARCHIVED'))`,
    );
  }
}
