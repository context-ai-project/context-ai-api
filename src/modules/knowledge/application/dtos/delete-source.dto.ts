/**
 * DTO for knowledge source deletion request
 *
 * Contains the identifiers needed to delete a knowledge source
 * and its associated vectors from Pinecone.
 */
export interface DeleteSourceDto {
  /**
   * ID of the knowledge source to delete
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  sourceId: string;

  /**
   * Sector/context identifier the source belongs to
   * Used to target the correct Pinecone namespace for vector cleanup
   * @example "660e8400-e29b-41d4-a716-446655440001"
   */
  sectorId: string;
}

/**
 * Result of knowledge source deletion
 */
export interface DeleteSourceResult {
  /**
   * ID of the deleted knowledge source
   */
  sourceId: string;

  /**
   * Number of fragments removed from PostgreSQL
   */
  fragmentsDeleted: number;

  /**
   * Whether vectors were cleaned up from Pinecone
   */
  vectorsDeleted: boolean;
}
