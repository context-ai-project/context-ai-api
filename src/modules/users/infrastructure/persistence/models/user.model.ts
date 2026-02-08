import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Column type constants
const VARCHAR_255 = 'varchar';
const TIMESTAMP_TZ = 'timestamp with time zone';
const STRING_LENGTH_255 = 255;

/**
 * User Persistence Model (TypeORM)
 *
 * Maps to the `users` table in PostgreSQL
 *
 * Indexes:
 * - auth0_user_id: Unique index for fast lookups by Auth0 sub
 * - email: Unique index for fast lookups by email
 * - is_active: Partial index for active users only
 */
@Entity('users')
@Index(['auth0UserId'], { unique: true })
@Index(['email'], { unique: true })
@Index(['isActive'], { where: 'is_active = true' })
export class UserModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'auth0_user_id',
    type: VARCHAR_255,
    length: STRING_LENGTH_255,
    unique: true,
  })
  auth0UserId!: string;

  @Column({ type: VARCHAR_255, length: STRING_LENGTH_255, unique: true })
  email!: string;

  @Column({ type: VARCHAR_255, length: STRING_LENGTH_255 })
  name!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true;

  @CreateDateColumn({ name: 'created_at', type: TIMESTAMP_TZ })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: TIMESTAMP_TZ })
  updatedAt!: Date;

  @Column({ name: 'last_login_at', type: TIMESTAMP_TZ, nullable: true })
  lastLoginAt: Date | null = null;
}
