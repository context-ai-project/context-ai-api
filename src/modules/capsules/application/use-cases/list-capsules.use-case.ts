import { Injectable, Inject, Logger } from '@nestjs/common';
import type {
  ICapsuleRepository,
  CapsuleFilters,
  PaginationOptions,
  PaginatedResult,
} from '../../domain/repositories/capsule.repository.interface';
import { Capsule } from '../../domain/entities/capsule.entity';
import { CapsuleStatus } from '@shared/types/enums/capsule-status.enum';
import { CapsuleType } from '@shared/types/enums/capsule-type.enum';
import { PAGINATION } from '@shared/constants';

export interface ListCapsulesInput {
  sectorId?: string;
  status?: CapsuleStatus;
  type?: CapsuleType;
  search?: string;
  page?: number;
  limit?: number;
  /** When provided, restrict results to capsules created by this user */
  createdBy?: string;
  /** When true, only returns ACTIVE capsules (enforces user-role visibility) */
  onlyActive?: boolean;
}

/**
 * List Capsules Use Case
 *
 * Returns a paginated list of capsules applying the provided filters.
 * Visibility rules:
 * - admin/manager: see all capsules (respects filters)
 * - user: only ACTIVE capsules (onlyActive=true enforced by controller)
 */
@Injectable()
export class ListCapsulesUseCase {
  private readonly logger = new Logger(ListCapsulesUseCase.name);

  constructor(
    @Inject('ICapsuleRepository')
    private readonly capsuleRepository: ICapsuleRepository,
  ) {}

  private static readonly DEFAULT_PAGE = PAGINATION.DEFAULT_PAGE;
  private static readonly DEFAULT_LIMIT = PAGINATION.DEFAULT_LIMIT;
  private static readonly MAX_LIMIT = PAGINATION.MAX_LIMIT;
  private static readonly MIN_PAGE = PAGINATION.MIN_PAGE;
  private static readonly MIN_LIMIT = PAGINATION.MIN_LIMIT;

  async execute(input: ListCapsulesInput): Promise<PaginatedResult<Capsule>> {
    const page = Math.max(
      ListCapsulesUseCase.MIN_PAGE,
      input.page ?? ListCapsulesUseCase.DEFAULT_PAGE,
    );
    const limit = Math.min(
      ListCapsulesUseCase.MAX_LIMIT,
      Math.max(
        ListCapsulesUseCase.MIN_LIMIT,
        input.limit ?? ListCapsulesUseCase.DEFAULT_LIMIT,
      ),
    );

    const filters: CapsuleFilters = {
      sectorId: input.sectorId,
      type: input.type,
      search: input.search,
      createdBy: input.createdBy,
    };

    // Enforce visibility rules:
    // - onlyActive=true (user role): restrict to ACTIVE capsules only
    // - explicit status filter: use as requested (allows viewing ARCHIVED via filter)
    // - no filter: exclude ARCHIVED by default (soft-deleted capsules are not shown)
    if (input.onlyActive) {
      filters.status = CapsuleStatus.ACTIVE;
    } else if (input.status) {
      filters.status = input.status;
    } else {
      filters.excludeArchived = true;
    }

    this.logger.debug(
      `Listing capsules with filters: ${JSON.stringify(filters)}`,
    );

    return this.capsuleRepository.findAll(filters, {
      page,
      limit,
    } as PaginationOptions);
  }
}
