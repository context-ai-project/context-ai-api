import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { InvitationStatus } from '@shared/types';
import { UserModel } from '../../../../users/infrastructure/persistence/models/user.model';
import { SectorModel } from '../../../../sectors/infrastructure/persistence/models/sector.model';

// Column type constants
const VARCHAR_TYPE = 'varchar';
const TIMESTAMP_TZ = 'timestamp with time zone';
const STRING_255 = 255;
const STRING_50 = 50;
const STRING_20 = 20;

/**
 * TypeORM Model for Invitation
 *
 * Maps to the `invitations` database table.
 *
 * Relationships:
 * - ManyToOne with UserModel (invited_by)
 * - ManyToMany with SectorModel (via invitation_sectors)
 */
@Entity('invitations')
@Index(['email'])
@Index(['status'])
@Index(['token'], { unique: true })
export class InvitationModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: VARCHAR_TYPE, length: STRING_255 })
  email!: string;

  @Column({ type: VARCHAR_TYPE, length: STRING_255 })
  name!: string;

  @Column({ type: VARCHAR_TYPE, length: STRING_50, default: 'user' })
  role!: string;

  @Column({
    type: VARCHAR_TYPE,
    length: STRING_20,
    default: InvitationStatus.PENDING,
  })
  status!: InvitationStatus;

  @Column({ type: VARCHAR_TYPE, length: STRING_255, unique: true })
  token!: string;

  @Column({ name: 'invited_by', type: 'uuid' })
  invitedBy!: string;

  @ManyToOne(() => UserModel)
  @JoinColumn({ name: 'invited_by' })
  invitedByUser!: UserModel;

  @Column({
    name: 'auth0_user_id',
    type: VARCHAR_TYPE,
    length: STRING_255,
    nullable: true,
  })
  auth0UserId!: string | null;

  /**
   * Sectors assigned to the invited user (Many-to-Many)
   * On acceptance, these are copied to user_sectors
   */
  @ManyToMany(() => SectorModel, { eager: true })
  @JoinTable({
    name: 'invitation_sectors',
    joinColumn: { name: 'invitation_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'sector_id', referencedColumnName: 'id' },
  })
  sectors!: SectorModel[];

  @Column({ name: 'expires_at', type: TIMESTAMP_TZ })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: TIMESTAMP_TZ, nullable: true })
  acceptedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: TIMESTAMP_TZ })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: TIMESTAMP_TZ })
  updatedAt!: Date;
}
