import { SectorStatus, SectorIcon } from '@shared/types';

/**
 * Sector Entity (Aggregate Root)
 *
 * Represents a knowledge sector in the system (e.g. Human Resources, Engineering).
 * Each sector groups related knowledge sources and controls access to them.
 *
 * Business rules:
 * - Name must be unique (case-insensitive)
 * - Name length: 2–100 characters
 * - Description length: 10–500 characters
 * - Status is ACTIVE by default
 * - Cannot delete a sector with associated documents
 */
export class Sector {
  public id?: string;
  public name: string;
  public description: string;
  public icon: SectorIcon;
  public status: SectorStatus;
  public createdAt: Date;
  public updatedAt: Date;

  // Business rule constants
  static readonly NAME_MIN_LENGTH = 2;
  static readonly NAME_MAX_LENGTH = 100;
  static readonly DESC_MIN_LENGTH = 10;
  static readonly DESC_MAX_LENGTH = 500;

  constructor(data: { name: string; description: string; icon: SectorIcon }) {
    this.validate(data);

    this.name = data.name.trim();
    this.description = data.description.trim();
    this.icon = data.icon;
    this.status = SectorStatus.ACTIVE;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  // ==================== Validation ====================

  private validate(data: {
    name: string;
    description: string;
    icon: SectorIcon;
  }): void {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error('Sector name cannot be empty');
    }
    if (trimmedName.length < Sector.NAME_MIN_LENGTH) {
      throw new Error(
        `Sector name must be at least ${Sector.NAME_MIN_LENGTH} characters`,
      );
    }
    if (trimmedName.length > Sector.NAME_MAX_LENGTH) {
      throw new Error(
        `Sector name cannot exceed ${Sector.NAME_MAX_LENGTH} characters`,
      );
    }

    const trimmedDesc = data.description.trim();
    if (!trimmedDesc) {
      throw new Error('Sector description cannot be empty');
    }
    if (trimmedDesc.length < Sector.DESC_MIN_LENGTH) {
      throw new Error(
        `Sector description must be at least ${Sector.DESC_MIN_LENGTH} characters`,
      );
    }
    if (trimmedDesc.length > Sector.DESC_MAX_LENGTH) {
      throw new Error(
        `Sector description cannot exceed ${Sector.DESC_MAX_LENGTH} characters`,
      );
    }

    const validIcons = Object.values(SectorIcon) as string[];
    if (!validIcons.includes(data.icon)) {
      throw new Error('Invalid sector icon');
    }
  }

  // ==================== Status Management ====================

  /**
   * Activates the sector so it becomes available for chat and document uploads
   */
  public activate(): void {
    this.status = SectorStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  /**
   * Deactivates the sector — disables chat and document uploads
   */
  public deactivate(): void {
    this.status = SectorStatus.INACTIVE;
    this.updatedAt = new Date();
  }

  /**
   * Toggles the sector status between active and inactive
   */
  public toggleStatus(): void {
    if (this.isActive()) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  // ==================== Status Checks ====================

  public isActive(): boolean {
    return this.status === SectorStatus.ACTIVE;
  }

  public isInactive(): boolean {
    return this.status === SectorStatus.INACTIVE;
  }

  // ==================== Update ====================

  /**
   * Updates the sector fields
   * Only updates fields that are provided (partial update)
   */
  public update(data: {
    name?: string;
    description?: string;
    icon?: SectorIcon;
  }): void {
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (trimmed.length < Sector.NAME_MIN_LENGTH) {
        throw new Error(
          `Sector name must be at least ${Sector.NAME_MIN_LENGTH} characters`,
        );
      }
      if (trimmed.length > Sector.NAME_MAX_LENGTH) {
        throw new Error(
          `Sector name cannot exceed ${Sector.NAME_MAX_LENGTH} characters`,
        );
      }
      this.name = trimmed;
    }

    if (data.description !== undefined) {
      const trimmed = data.description.trim();
      if (trimmed.length < Sector.DESC_MIN_LENGTH) {
        throw new Error(
          `Sector description must be at least ${Sector.DESC_MIN_LENGTH} characters`,
        );
      }
      if (trimmed.length > Sector.DESC_MAX_LENGTH) {
        throw new Error(
          `Sector description cannot exceed ${Sector.DESC_MAX_LENGTH} characters`,
        );
      }
      this.description = trimmed;
    }

    if (data.icon !== undefined) {
      const validIcons = Object.values(SectorIcon) as string[];
      if (!validIcons.includes(data.icon)) {
        throw new Error('Invalid sector icon');
      }
      this.icon = data.icon;
    }

    this.updatedAt = new Date();
  }
}
