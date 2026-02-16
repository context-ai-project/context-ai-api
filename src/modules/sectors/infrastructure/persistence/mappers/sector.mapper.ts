import { Sector } from '@modules/sectors/domain/entities/sector.entity';
import { SectorModel } from '@modules/sectors/infrastructure/persistence/models/sector.model';

/**
 * Sector Mapper
 *
 * Converts between domain entities and TypeORM models.
 * Follows Clean Architecture principles (Dependency Inversion).
 */
export class SectorMapper {
  /**
   * Converts TypeORM model to domain entity
   */
  static toDomain(model: SectorModel): Sector {
    const sector = new Sector({
      name: model.name,
      description: model.description,
      icon: model.icon,
    });

    // Hydrate persisted fields
    const mutableSector = sector as {
      id?: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    };

    mutableSector.id = model.id;
    mutableSector.status = model.status as string;
    mutableSector.createdAt = model.createdAt;
    mutableSector.updatedAt = model.updatedAt;

    return sector;
  }

  /**
   * Converts domain entity to TypeORM model
   */
  static toModel(entity: Sector): SectorModel {
    const model = new SectorModel();

    if (entity.id) {
      model.id = entity.id;
    }
    model.name = entity.name;
    model.description = entity.description;
    model.icon = entity.icon;
    model.status = entity.status;
    model.createdAt = entity.createdAt;
    model.updatedAt = entity.updatedAt;

    return model;
  }

  /**
   * Converts array of TypeORM models to domain entities
   */
  static toDomainArray(models: SectorModel[]): Sector[] {
    return models.map((model) => this.toDomain(model));
  }
}
