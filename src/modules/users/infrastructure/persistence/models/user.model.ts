import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { RoleModel } from '../../../../auth/infrastructure/persistence/models/role.model';
import { SectorModel } from '../../../../sectors/infrastructure/persistence/models/sector.model';

// Column type constants
const VARCHAR_255 = 'varchar';
const TIMESTAMP_TZ = 'timestamp with time zone';
const STRING_LENGTH_255 = 255;

/**
 * User Persistence Model (TypeORM)
 *
 * Maps to the `users` table in PostgreSQL
 *
 * Relations:
 * - Many-to-Many with RoleModel (through user_roles)
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

  /**
   * Roles assigned to this user
   * Many-to-Many relationship through user_roles table
   */
  @ManyToMany(() => RoleModel, (role) => role.users)
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles!: RoleModel[];

  /**
   * Sectors assigned to this user
   * Many-to-Many relationship through user_sectors table
   */
  @ManyToMany(() => SectorModel, (sector) => sector.users)
  @JoinTable({
    name: 'user_sectors',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'sector_id', referencedColumnName: 'id' },
  })
  sectors!: SectorModel[];
}
