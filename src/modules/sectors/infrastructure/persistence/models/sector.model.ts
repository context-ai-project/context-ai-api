import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
} from 'typeorm';
import { SectorStatus, SectorIcon } from '@shared/types';
import { UserModel } from '../../../../users/infrastructure/persistence/models/user.model';

/**
 * TypeORM Model for Sector
 *
 * Maps the domain entity to the `sectors` database table.
 * Uses snake_case for column names (PostgreSQL convention).
 *
 * Features:
 * - UUID primary key
 * - Unique name constraint
 * - Indexes for performance
 */
@Entity('sectors')
@Index(['status'])
export class SectorModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 500 })
  description!: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: SectorIcon.LAYOUT,
  })
  icon!: SectorIcon;

  @Column({
    type: 'varchar',
    length: 20,
    default: SectorStatus.ACTIVE,
  })
  status!: SectorStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date = new Date();

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date = new Date();

  /**
   * Users assigned to this sector
   * Many-to-Many relationship through user_sectors table (owned by UserModel)
   */
  @ManyToMany(() => UserModel, (user) => user.sectors)
  users!: UserModel[];
}
