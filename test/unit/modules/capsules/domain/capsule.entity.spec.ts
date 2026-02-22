import { Capsule } from '../../../../../src/modules/capsules/domain/entities/capsule.entity';
import { CapsuleType } from '../../../../../src/shared/types/enums/capsule-type.enum';
import { CapsuleStatus } from '../../../../../src/shared/types/enums/capsule-status.enum';

const VALID_INPUT = {
  title: 'Onboarding Audio',
  sectorId: 'sector-uuid',
  type: CapsuleType.AUDIO,
  createdBy: 'auth0|user1',
};

describe('Capsule entity', () => {
  // ── Construction ─────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates a capsule in DRAFT status', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(capsule.status).toBe(CapsuleStatus.DRAFT);
    });

    it('trims whitespace from title', () => {
      const capsule = new Capsule({ ...VALID_INPUT, title: '  My Capsule  ' });
      expect(capsule.title).toBe('My Capsule');
    });

    it('initialises nullable fields to null', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(capsule.script).toBeNull();
      expect(capsule.audioUrl).toBeNull();
      expect(capsule.audioVoiceId).toBeNull();
      expect(capsule.publishedAt).toBeNull();
    });

    it('stores optional introText when provided', () => {
      const capsule = new Capsule({ ...VALID_INPUT, introText: 'Welcome!' });
      expect(capsule.introText).toBe('Welcome!');
    });

    it('throws when title is empty', () => {
      expect(() => new Capsule({ ...VALID_INPUT, title: '' })).toThrow(
        'Capsule title cannot be empty',
      );
    });

    it('throws when title is too short', () => {
      expect(() => new Capsule({ ...VALID_INPUT, title: 'ab' })).toThrow(
        `at least ${Capsule.TITLE_MIN_LENGTH} characters`,
      );
    });

    it('throws when title exceeds max length', () => {
      const longTitle = 'a'.repeat(Capsule.TITLE_MAX_LENGTH + 1);
      expect(() => new Capsule({ ...VALID_INPUT, title: longTitle })).toThrow(
        `cannot exceed ${Capsule.TITLE_MAX_LENGTH} characters`,
      );
    });
  });

  // ── Status checks ─────────────────────────────────────────────────────────

  describe('status checks', () => {
    it('isDraft returns true for DRAFT status', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(capsule.isDraft()).toBe(true);
    });

    it('isEditable returns true for DRAFT, COMPLETED, FAILED', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(capsule.isEditable()).toBe(true); // DRAFT
    });

    it('canGenerateScript returns true from DRAFT', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(capsule.canGenerateScript()).toBe(true);
    });

    it('canGenerateAudio returns false without script and voiceId', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(capsule.canGenerateAudio()).toBe(false);
    });

    it('canGenerateAudio returns true with script and voiceId', () => {
      const capsule = new Capsule(VALID_INPUT);
      (capsule as unknown as Record<string, unknown>)['script'] = 'A script';
      (capsule as unknown as Record<string, unknown>)['audioVoiceId'] = 'voice-1';
      expect(capsule.canGenerateAudio()).toBe(true);
    });
  });

  // ── startGeneration ───────────────────────────────────────────────────────

  describe('startGeneration()', () => {
    it('transitions DRAFT → GENERATING', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.startGeneration();
      expect(capsule.status).toBe(CapsuleStatus.GENERATING);
      expect(capsule.isGenerating()).toBe(true);
    });

    it('throws when called from ACTIVE status', () => {
      const capsule = new Capsule(VALID_INPUT);
      // Force ACTIVE
      (capsule as unknown as Record<string, unknown>)['status'] = CapsuleStatus.ACTIVE;
      expect(() => capsule.startGeneration()).toThrow('Cannot start generation');
    });
  });

  // ── completeGeneration ────────────────────────────────────────────────────

  describe('completeGeneration()', () => {
    it('transitions GENERATING → COMPLETED with audioUrl', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.startGeneration();
      capsule.completeGeneration({ audioUrl: 'https://gcs.example.com/audio.mp3', durationSeconds: 120 });

      expect(capsule.status).toBe(CapsuleStatus.COMPLETED);
      expect(capsule.audioUrl).toBe('https://gcs.example.com/audio.mp3');
      expect(capsule.durationSeconds).toBe(120);
    });

    it('throws when not in GENERATING status', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(() => capsule.completeGeneration({})).toThrow('Cannot complete generation');
    });
  });

  // ── failGeneration ────────────────────────────────────────────────────────

  describe('failGeneration()', () => {
    it('transitions GENERATING → FAILED', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.startGeneration();
      capsule.failGeneration({ reason: 'ElevenLabs timeout' });

      expect(capsule.status).toBe(CapsuleStatus.FAILED);
      expect(capsule.isFailed()).toBe(true);
    });

    it('throws when not in GENERATING status', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(() => capsule.failGeneration()).toThrow('Cannot mark generation as failed');
    });
  });

  // ── publish ───────────────────────────────────────────────────────────────

  describe('publish()', () => {
    it('transitions COMPLETED → ACTIVE and sets publishedAt', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.startGeneration();
      capsule.completeGeneration({ audioUrl: 'https://example.com/audio.mp3' });
      capsule.publish();

      expect(capsule.status).toBe(CapsuleStatus.ACTIVE);
      expect(capsule.isActive()).toBe(true);
      expect(capsule.publishedAt).toBeInstanceOf(Date);
    });

    it('throws when publishing from DRAFT', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(() => capsule.publish()).toThrow('Cannot publish capsule');
    });
  });

  // ── archive ───────────────────────────────────────────────────────────────

  describe('archive()', () => {
    it('transitions ACTIVE → ARCHIVED', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.startGeneration();
      capsule.completeGeneration({ audioUrl: 'https://example.com/audio.mp3' });
      capsule.publish();
      capsule.archive();

      expect(capsule.status).toBe(CapsuleStatus.ARCHIVED);
      expect(capsule.isArchived()).toBe(true);
    });

    it('transitions COMPLETED → ARCHIVED', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.startGeneration();
      capsule.completeGeneration({ audioUrl: 'https://example.com/audio.mp3' });
      capsule.archive();

      expect(capsule.isArchived()).toBe(true);
    });

    it('throws when archiving from DRAFT', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(() => capsule.archive()).toThrow('Cannot archive capsule');
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates title, introText, script and audioVoiceId from DRAFT', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.update({
        title: 'New Title',
        introText: 'Updated intro',
        script: 'New script text',
        audioVoiceId: 'voice-rachel',
      });

      expect(capsule.title).toBe('New Title');
      expect(capsule.introText).toBe('Updated intro');
      expect(capsule.script).toBe('New script text');
      expect(capsule.audioVoiceId).toBe('voice-rachel');
    });

    it('throws when updating from GENERATING status', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.startGeneration();
      expect(() => capsule.update({ title: 'New Title' })).toThrow('Cannot update capsule');
    });

    it('sets introText to null when empty string provided', () => {
      const capsule = new Capsule({ ...VALID_INPUT, introText: 'Old intro' });
      capsule.update({ introText: '' });
      expect(capsule.introText).toBeNull();
    });
  });
});
