import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { ISectorRepository } from '../../domain/repositories/sector.repository.interface';
import type { IKnowledgeRepository } from '../../../knowledge/domain/repositories/knowledge.repository.interface';

/**
 * Delete Sector Use Case
 *
 * Deletes a sector after validating:
 * - Sector exists
 * - No associated documents (business rule: cannot delete sector with documents)
 */
@Injectable()
export class DeleteSectorUseCase {
  private readonly logger = new Logger(DeleteSectorUseCase.name);

  constructor(
    @Inject('ISectorRepository')
    private readonly sectorRepository: ISectorRepository,
    @Inject('IKnowledgeRepository')
    private readonly knowledgeRepository: IKnowledgeRepository,
  ) {}

  async execute(id: string): Promise<{ id: string; message: string }> {
    this.logger.log(`Deleting sector: ${id}`);

    // Find existing sector
    const sector = await this.sectorRepository.findById(id);
    if (!sector) {
      throw new NotFoundException(`Sector not found: ${id}`);
    }

    // Check for associated documents
    const documentCount =
      await this.knowledgeRepository.countSourcesBySector(id);
    if (documentCount > 0) {
      throw new BadRequestException(
        `Cannot delete sector "${sector.name}": it has ${documentCount} associated document(s). ` +
          'Remove or reassign all documents before deleting the sector.',
      );
    }

    // Delete
    await this.sectorRepository.delete(id);

    this.logger.log(`Sector deleted successfully: ${id}`);
    return { id, message: 'Sector deleted successfully' };
  }
}
