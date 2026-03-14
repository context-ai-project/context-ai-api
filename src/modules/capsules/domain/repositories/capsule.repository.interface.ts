import { Capsule, CapsuleSourceRef } from '../entities/capsule.entity';
import { CapsuleStatus } from '@shared/types/enums/capsule-status.enum';
import { CapsuleType } from '@shared/types/enums/capsule-type.enum';

/**
 * Pagination and filter options for capsule queries.
 */
export interface CapsuleFilters {
  sectorId?: string;
  status?: CapsuleStatus;
  type?: CapsuleType;
  createdBy?: string;
  search?: string;
  /**
   * When true, exclude capsules with ARCHIVED status from results.
   * Used by the default listing behaviour so soft-deleted capsules
   * are hidden unless the caller explicitly requests status=ARCHIVED.
   */
  excludeArchived?: boolean;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * ICapsuleRepository
 *
 * Contract for capsule persistence operations.
 * Follows Repository pattern and Dependency Inversion Principle —
 * use cases depend on this interface, not on TypeORM directly.
 */
export interface ICapsuleRepository {
  /**
   * Saves a capsule (create or update).
   * Returns the saved capsule with ID assigned.
   */
  save(capsule: Capsule): Promise<Capsule>;

  /**
   * Finds a capsule by ID. Returns null if not found.
   */
  findById(id: string): Promise<Capsule | null>;

  /**
   * Finds capsules with optional filters and pagination.
   */
  findAll(
    filters: CapsuleFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Capsule>>;

  /**
   * Finds capsules belonging to a specific sector.
   */
  findBySectorId(
    sectorId: string,
    filters?: Partial<CapsuleFilters>,
  ): Promise<Capsule[]>;

  /**
   * Soft-deletes (archives) a capsule by ID.
   */
  delete(id: string): Promise<void>;

  /**
   * Associates knowledge source IDs with a capsule via capsule_sources.
   */
  addSources(capsuleId: string, sourceIds: string[]): Promise<void>;

  /**
   * Retrieves the knowledge sources linked to a capsule.
   */
  getSources(capsuleId: string): Promise<CapsuleSourceRef[]>;

  /**
   * Counts capsules by sector and status (for quota calculations).
   */
  countBySectorAndStatus(
    sectorId: string,
    status: CapsuleStatus,
  ): Promise<number>;

  /**
   * Counts video capsules (type VIDEO) created in the current calendar month.
   * Used for monthly video generation quota enforcement.
   */
  countVideoCapsulesThisMonth(): Promise<number>;
}
