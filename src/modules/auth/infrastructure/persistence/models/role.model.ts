import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { UserModel } from '../../../../users/infrastructure/persistence/models/user.model';
import { PermissionModel } from './permission.model';

/**
 * Role Persistence Model (TypeORM)
 *
 * Maps to the `roles` table in PostgreSQL
 *
 * Relations:
 * - Many-to-Many with UserModel (through user_roles)
 * - Many-to-Many with PermissionModel (through role_permissions)
 *
 * Indexes:
 * - name: Unique index for role names
 */
@Entity('roles')
@Index(['name'], { unique: true })
export class RoleModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_system_role', type: 'boolean', default: false })
  isSystemRole!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  /**
   * Users that have this role
   */
  @ManyToMany(() => UserModel, (user) => user.roles)
  users!: UserModel[];

  /**
   * Permissions associated with this role
   */
  @ManyToMany(() => PermissionModel, (permission) => permission.roles)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions!: PermissionModel[];
}
