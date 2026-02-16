import { SectorMapper } from '../../../../../../../src/modules/sectors/infrastructure/persistence/mappers/sector.mapper';
import { SectorModel } from '../../../../../../../src/modules/sectors/infrastructure/persistence/models/sector.model';
import { Sector } from '../../../../../../../src/modules/sectors/domain/entities/sector.entity';
import { SectorIcon, SectorStatus } from '@shared/types';

describe('SectorMapper', () => {
  const sectorId = '550e8400-e29b-41d4-a716-446655440000';
  const now = new Date('2025-06-01T12:00:00Z');

  function createModel(overrides?: Partial<SectorModel>): SectorModel {
    const model = new SectorModel();
    model.id = sectorId;
    model.name = 'Human Resources';
    model.description = 'Company policies and employee handbook';
    model.icon = SectorIcon.USERS;
    model.status = SectorStatus.ACTIVE;
    model.createdAt = now;
    model.updatedAt = now;
    Object.assign(model, overrides);
    return model;
  }

  describe('toDomain', () => {
    it('should map SectorModel to Sector domain entity', () => {
      const model = createModel();

      const domain = SectorMapper.toDomain(model);

      expect(domain).toBeInstanceOf(Sector);
      expect(domain.id).toBe(sectorId);
      expect(domain.name).toBe('Human Resources');
      expect(domain.description).toBe('Company policies and employee handbook');
      expect(domain.icon).toBe(SectorIcon.USERS);
      expect(domain.status).toBe(SectorStatus.ACTIVE);
      expect(domain.createdAt).toBe(now);
      expect(domain.updatedAt).toBe(now);
    });
  });

  describe('toModel', () => {
    it('should map Sector domain entity to SectorModel', () => {
      const sector = new Sector({
        name: 'Engineering',
        description: 'Technical documentation',
        icon: SectorIcon.CODE,
      });

      const model = SectorMapper.toModel(sector);

      expect(model).toBeInstanceOf(SectorModel);
      expect(model.name).toBe('Engineering');
      expect(model.description).toBe('Technical documentation');
      expect(model.icon).toBe(SectorIcon.CODE);
    });

    it('should include ID when sector has one', () => {
      const sector = new Sector({
        name: 'HR',
        description: 'Description',
        icon: SectorIcon.USERS,
      });
      // Hydrate an id
      const mutable = sector as { id?: string };
      mutable.id = sectorId;

      const model = SectorMapper.toModel(sector);

      expect(model.id).toBe(sectorId);
    });
  });

  describe('toDomainArray', () => {
    it('should map array of models to array of domain entities', () => {
      const models = [
        createModel(),
        createModel({ id: '550e8400-e29b-41d4-a716-446655440001', name: 'IT' }),
      ];

      const domains = SectorMapper.toDomainArray(models);

      expect(domains).toHaveLength(2);
      expect(domains[0].name).toBe('Human Resources');
      expect(domains[1].name).toBe('IT');
    });

    it('should return empty array for empty input', () => {
      const domains = SectorMapper.toDomainArray([]);
      expect(domains).toHaveLength(0);
    });
  });
});

