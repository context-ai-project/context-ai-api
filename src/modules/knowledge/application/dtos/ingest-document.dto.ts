import { SourceType } from '@shared/types';

/**
 * DTO for document ingestion request
 *
 * Contains the raw document data and metadata needed to process
 * and store a knowledge source with its fragments.
 */
export interface IngestDocumentDto {
  /**
   * Document title
   * @example "Company Onboarding Guide"
   */
  title: string;

  /**
   * Sector/context identifier this document belongs to
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  sectorId: string;

  /**
   * Type of source document
   */
  sourceType: SourceType;

  /**
   * Raw document buffer (file contents)
   */
  buffer: Buffer;

  /**
   * Optional metadata for the document
   */
  metadata?: Record<string, unknown>;
}

/**
 * Result of document ingestion
 *
 * Contains the created knowledge source ID and statistics
 * about the ingestion process.
 */
export interface IngestDocumentResult {
  /**
   * ID of the created knowledge source
   */
  sourceId: string;

  /**
   * Title of the processed document
   */
  title: string;

  /**
   * Number of fragments created
   */
  fragmentCount: number;

  /**
   * Total size of processed content in bytes
   */
  contentSize: number;

  /**
   * Processing status
   */
  status: 'COMPLETED' | 'FAILED';

  /**
   * Optional error message if processing failed
   */
  errorMessage?: string;
}
