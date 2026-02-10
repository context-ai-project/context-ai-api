import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
} from 'typeorm';
import { RoleModel } from './role.model';

/**
 * Permission Persistence Model (TypeORM)
 *
 * Maps to the `permissions` table in PostgreSQL
 *
 * Relations:
 * - Many-to-Many with RoleModel (through role_permissions)
 *
 * Indexes:
 * - name: Unique index for permission names (resource:action)
 * - resource: Index for filtering by resource
 * - action: Index for filtering by action
 */
@Entity('permissions')
@Index(['name'], { unique: true })
@Index(['resource'])
@Index(['action'])
export class PermissionModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 50 })
  resource!: string;

  @Column({ type: 'varchar', length: 50 })
  action!: string;

  @Column({
    name: 'is_system_permission',
    type: 'boolean',
    default: false,
  })
  isSystemPermission!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  /**
   * Roles that have this permission
   */
  @ManyToMany(() => RoleModel, (role) => role.permissions)
  roles!: RoleModel[];
}

