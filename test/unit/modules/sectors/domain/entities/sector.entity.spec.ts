import { Sector } from '../../../../../../src/modules/sectors/domain/entities/sector.entity';
import { SectorStatus, SectorIcon } from '@shared/types';

describe('Sector Entity', () => {
  const validData = {
    name: 'Human Resources',
    description: 'Company policies, benefits, onboarding guides, and employee handbook.',
    icon: SectorIcon.USERS,
  };

  describe('constructor', () => {
    it('should create a valid sector with default status ACTIVE', () => {
      const sector = new Sector(validData);

      expect(sector.name).toBe('Human Resources');
      expect(sector.description).toBe(validData.description);
      expect(sector.icon).toBe(SectorIcon.USERS);
      expect(sector.status).toBe(SectorStatus.ACTIVE);
      expect(sector.createdAt).toBeInstanceOf(Date);
      expect(sector.updatedAt).toBeInstanceOf(Date);
    });

    it('should trim name and description', () => {
      const sector = new Sector({
        ...validData,
        name: '  Engineering  ',
        description: '  Technical documentation and standards.  ',
      });

      expect(sector.name).toBe('Engineering');
      expect(sector.description).toBe('Technical documentation and standards.');
    });

    it('should throw when name is empty', () => {
      expect(() => new Sector({ ...validData, name: '' })).toThrow(
        'Sector name cannot be empty',
      );
    });

    it('should throw when name is too short', () => {
      expect(() => new Sector({ ...validData, name: 'A' })).toThrow(
        `Sector name must be at least ${Sector.NAME_MIN_LENGTH} characters`,
      );
    });

    it('should throw when name exceeds max length', () => {
      expect(
        () => new Sector({ ...validData, name: 'X'.repeat(101) }),
      ).toThrow(
        `Sector name cannot exceed ${Sector.NAME_MAX_LENGTH} characters`,
      );
    });

    it('should throw when description is empty', () => {
      expect(() => new Sector({ ...validData, description: '' })).toThrow(
        'Sector description cannot be empty',
      );
    });

    it('should throw when description is too short', () => {
      expect(
        () => new Sector({ ...validData, description: 'Short' }),
      ).toThrow(
        `Sector description must be at least ${Sector.DESC_MIN_LENGTH} characters`,
      );
    });

    it('should throw when description exceeds max length', () => {
      expect(
        () => new Sector({ ...validData, description: 'X'.repeat(501) }),
      ).toThrow(
        `Sector description cannot exceed ${Sector.DESC_MAX_LENGTH} characters`,
      );
    });

    it('should throw when icon is invalid', () => {
      expect(
        () =>
          new Sector({ ...validData, icon: 'invalid-icon' as SectorIcon }),
      ).toThrow('Invalid sector icon');
    });
  });

  describe('status management', () => {
    it('should activate a sector', () => {
      const sector = new Sector(validData);
      sector.deactivate();
      expect(sector.status).toBe(SectorStatus.INACTIVE);

      sector.activate();
      expect(sector.status).toBe(SectorStatus.ACTIVE);
    });

    it('should deactivate a sector', () => {
      const sector = new Sector(validData);
      sector.deactivate();
      expect(sector.status).toBe(SectorStatus.INACTIVE);
    });

    it('should toggle status from active to inactive', () => {
      const sector = new Sector(validData);
      expect(sector.isActive()).toBe(true);

      sector.toggleStatus();

      expect(sector.isActive()).toBe(false);
      expect(sector.isInactive()).toBe(true);
    });

    it('should toggle status from inactive to active', () => {
      const sector = new Sector(validData);
      sector.deactivate();
      expect(sector.isInactive()).toBe(true);

      sector.toggleStatus();

      expect(sector.isActive()).toBe(true);
      expect(sector.isInactive()).toBe(false);
    });
  });

  describe('status checks', () => {
    it('should return true for isActive when sector is active', () => {
      const sector = new Sector(validData);
      expect(sector.isActive()).toBe(true);
    });

    it('should return true for isInactive when sector is inactive', () => {
      const sector = new Sector(validData);
      sector.deactivate();
      expect(sector.isInactive()).toBe(true);
    });
  });

  describe('update', () => {
    it('should update name only', () => {
      const sector = new Sector(validData);
      const oldDescription = sector.description;

      sector.update({ name: 'Engineering Team' });

      expect(sector.name).toBe('Engineering Team');
      expect(sector.description).toBe(oldDescription);
    });

    it('should update description only', () => {
      const sector = new Sector(validData);
      const oldName = sector.name;

      sector.update({ description: 'Updated description for the sector with enough characters.' });

      expect(sector.name).toBe(oldName);
      expect(sector.description).toBe('Updated description for the sector with enough characters.');
    });

    it('should update icon only', () => {
      const sector = new Sector(validData);
      sector.update({ icon: SectorIcon.CODE });
      expect(sector.icon).toBe(SectorIcon.CODE);
    });

    it('should update all fields at once', () => {
      const sector = new Sector(validData);
      sector.update({
        name: 'New Name',
        description: 'A completely new description for the sector.',
        icon: SectorIcon.GLOBE,
      });

      expect(sector.name).toBe('New Name');
      expect(sector.description).toBe('A completely new description for the sector.');
      expect(sector.icon).toBe(SectorIcon.GLOBE);
    });

    it('should throw when updating name to too short', () => {
      const sector = new Sector(validData);
      expect(() => sector.update({ name: 'A' })).toThrow(
        `Sector name must be at least ${Sector.NAME_MIN_LENGTH} characters`,
      );
    });

    it('should throw when updating name to too long', () => {
      const sector = new Sector(validData);
      expect(() => sector.update({ name: 'X'.repeat(101) })).toThrow(
        `Sector name cannot exceed ${Sector.NAME_MAX_LENGTH} characters`,
      );
    });

    it('should throw when updating description to too short', () => {
      const sector = new Sector(validData);
      expect(() => sector.update({ description: 'Short' })).toThrow(
        `Sector description must be at least ${Sector.DESC_MIN_LENGTH} characters`,
      );
    });

    it('should throw when updating icon to invalid', () => {
      const sector = new Sector(validData);
      expect(() =>
        sector.update({ icon: 'invalid' as SectorIcon }),
      ).toThrow('Invalid sector icon');
    });

    it('should update the updatedAt timestamp', () => {
      const sector = new Sector(validData);
      const originalUpdatedAt = sector.updatedAt;

      // Small delay to ensure different timestamp
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      sector.update({ name: 'Updated Name' });

      expect(sector.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });
  });
});

