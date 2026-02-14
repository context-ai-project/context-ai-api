/**
 * UserContext Value Object
 *
 * Groups userId and sectorId, which always travel together
 * across queries, conversations, and repository methods.
 */
export interface UserContext {
  userId: string;
  sectorId: string;
}
