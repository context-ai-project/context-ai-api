/**
 * Type-safe metadata value
 * Represents JSON-serializable values
 *
 * Used by KnowledgeSource and Fragment entities for storing
 * additional context metadata.
 */
export type MetadataValue =
  | string
  | number
  | boolean
  | null
  | MetadataValue[]
  | { [key: string]: MetadataValue };

/**
 * Generic metadata record type
 * Stores key-value pairs of MetadataValue
 */
export type Metadata = Record<string, MetadataValue>;
