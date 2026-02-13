import { KnowledgeSource } from '../entities/knowledge-source.entity';
import { Fragment } from '../entities/fragment.entity';

/**
 * IKnowledgeRepository Interface
 *
 * Defines the contract for knowledge persistence operations.
 * Follows Repository pattern and Dependency Inversion Principle.
 *
 * Implementation will be in Infrastructure layer (TypeORM).
 *
 * Note: Vector similarity search has been moved to IVectorStore (Pinecone).
 * This repository now handles only relational data in PostgreSQL.
 */
export interface IKnowledgeRepository {
  // ==================== KnowledgeSource Operations ====================

  /**
   * Saves a knowledge source (create or update)
   * @param source - The knowledge source to save
   * @returns The saved knowledge source with assigned ID
   */
  saveSource(source: KnowledgeSource): Promise<KnowledgeSource>;

  /**
   * Finds a knowledge source by ID
   * @param id - The source ID
   * @returns The knowledge source or null if not found
   */
  findSourceById(id: string): Promise<KnowledgeSource | null>;

  /**
   * Finds all knowledge sources for a sector
   * @param sectorId - The sector ID
   * @param includeDeleted - Whether to include soft-deleted sources
   * @returns Array of knowledge sources
   */
  findSourcesBySector(
    sectorId: string,
    includeDeleted?: boolean,
  ): Promise<KnowledgeSource[]>;

  /**
   * Finds all knowledge sources (excluding soft-deleted)
   * @returns Array of all active knowledge sources
   */
  findAllSources(): Promise<KnowledgeSource[]>;

  /**
   * Finds knowledge sources by status
   * @param status - The status to filter by
   * @returns Array of knowledge sources with the given status
   */
  findSourcesByStatus(status: string): Promise<KnowledgeSource[]>;

  /**
   * Soft deletes a knowledge source (marks as deleted)
   * @param id - The source ID to soft delete
   */
  softDeleteSource(id: string): Promise<void>;

  /**
   * Deletes a knowledge source (hard delete)
   * @param id - The source ID to delete
   */
  deleteSource(id: string): Promise<void>;

  /**
   * Counts total sources in a sector
   * @param sectorId - The sector ID
   * @returns Total count of sources
   */
  countSourcesBySector(sectorId: string): Promise<number>;

  // ==================== Fragment Operations ====================

  /**
   * Saves fragments in batch (optimized for bulk insert)
   * @param fragments - Array of fragments to save
   * @returns Array of saved fragments with assigned IDs
   */
  saveFragments(fragments: Fragment[]): Promise<Fragment[]>;

  /**
   * Finds a fragment by ID
   * @param id - The fragment ID
   * @returns The fragment or null if not found
   */
  findFragmentById(id: string): Promise<Fragment | null>;

  /**
   * Finds all fragments for a knowledge source
   * @param sourceId - The source ID
   * @param orderBy - Order by field (default: position ASC)
   * @returns Array of fragments ordered by position
   */
  findFragmentsBySource(
    sourceId: string,
    orderBy?: 'position' | 'createdAt',
  ): Promise<Fragment[]>;

  /**
   * Deletes all fragments for a knowledge source
   * @param sourceId - The source ID
   */
  deleteFragmentsBySource(sourceId: string): Promise<void>;

  /**
   * Counts total fragments in a source
   * @param sourceId - The source ID
   * @returns Total count of fragments
   */
  countFragmentsBySource(sourceId: string): Promise<number>;

  // ==================== Transaction Support ====================

  /**
   * Executes operations within a transaction
   * @param work - The work to execute in the transaction
   * @returns The result of the work function
   */
  transaction<T>(work: () => Promise<T>): Promise<T>;
}
