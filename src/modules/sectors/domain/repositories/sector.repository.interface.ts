import { Sector } from '../entities/sector.entity';

/**
 * ISectorRepository Interface
 *
 * Defines the contract for sector persistence operations.
 * Follows Repository pattern and Dependency Inversion Principle.
 */
export interface ISectorRepository {
  /**
   * Saves a sector (create or update)
   * @param sector - The sector to save
   * @returns The saved sector with assigned ID
   */
  save(sector: Sector): Promise<Sector>;

  /**
   * Finds a sector by ID
   * @param id - The sector ID
   * @returns The sector or null if not found
   */
  findById(id: string): Promise<Sector | null>;

  /**
   * Finds a sector by name (case-insensitive)
   * @param name - The sector name
   * @returns The sector or null if not found
   */
  findByName(name: string): Promise<Sector | null>;

  /**
   * Finds all sectors
   * @returns Array of all sectors
   */
  findAll(): Promise<Sector[]>;

  /**
   * Finds all active sectors
   * @returns Array of active sectors
   */
  findAllActive(): Promise<Sector[]>;

  /**
   * Deletes a sector by ID (hard delete)
   * @param id - The sector ID to delete
   */
  delete(id: string): Promise<void>;

  /**
   * Checks if a sector name exists (case-insensitive), optionally excluding a sector ID
   * @param name - The name to check
   * @param excludeId - Optional sector ID to exclude from the check
   * @returns true if a sector with that name exists
   */
  existsByName(name: string, excludeId?: string): Promise<boolean>;

  /**
   * Counts total sectors
   * @returns Total number of sectors
   */
  countAll(): Promise<number>;

  /**
   * Counts sectors by status
   * @param status - The status to filter by
   * @returns Number of sectors with the given status
   */
  countByStatus(status: string): Promise<number>;
}
