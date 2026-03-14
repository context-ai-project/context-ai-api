import { Capsule } from '../../../../../src/modules/capsules/domain/entities/capsule.entity';
import { CapsuleType } from '../../../../../src/shared/types/enums/capsule-type.enum';
import { CapsuleStatus } from '../../../../../src/shared/types/enums/capsule-status.enum';

const VALID_INPUT = {
  title: 'Onboarding Audio',
  sectorId: 'sector-uuid',
  type: CapsuleType.AUDIO,
  createdBy: 'auth0|user1',
};

const VIDEO_SCENES_JSON = JSON.stringify([
  {
    textToNarrate: 'Welcome to the company',
    visualPrompt: 'modern office building',
    titleOverlay: 'Welcome',
  },
  {
    textToNarrate: 'Let us review policies',
    visualPrompt: 'team in conference room',
    titleOverlay: 'Policies',
  },
]);

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
      expect(capsule.isEditable()).toBe(true);
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
    it('transitions DRAFT → GENERATING_ASSETS', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.startGeneration();
      expect(capsule.status).toBe(CapsuleStatus.GENERATING_ASSETS);
      expect(capsule.isGeneratingAssets()).toBe(true);
    });

    it('throws when called from ACTIVE status', () => {
      const capsule = new Capsule(VALID_INPUT);
      (capsule as unknown as Record<string, unknown>)['status'] = CapsuleStatus.ACTIVE;
      expect(() => capsule.startGeneration()).toThrow('Cannot start generation');
    });
  });

  // ── startRendering ────────────────────────────────────────────────────────

  describe('startRendering()', () => {
    it('transitions GENERATING_ASSETS → RENDERING', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.startGeneration();
      capsule.startRendering();
      expect(capsule.status).toBe(CapsuleStatus.RENDERING);
      expect(capsule.isRendering()).toBe(true);
    });

    it('throws when not in GENERATING_ASSETS status', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(() => capsule.startRendering()).toThrow(
        'Cannot start rendering',
      );
    });
  });

  // ── completeGeneration ────────────────────────────────────────────────────

  describe('completeGeneration()', () => {
    it('transitions GENERATING_ASSETS → COMPLETED for audio capsule', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.startGeneration();
      capsule.completeGeneration({
        audioUrl: 'https://gcs.example.com/audio.mp3',
        durationSeconds: 120,
      });
      expect(capsule.status).toBe(CapsuleStatus.COMPLETED);
      expect(capsule.audioUrl).toBe('https://gcs.example.com/audio.mp3');
      expect(capsule.durationSeconds).toBe(120);
    });

    it('transitions RENDERING → COMPLETED for video capsule', () => {
      const capsule = new Capsule({
        ...VALID_INPUT,
        type: CapsuleType.VIDEO,
      });
      capsule.startGeneration();
      capsule.startRendering();
      capsule.completeGeneration({
        videoUrl: 'https://gcs.example.com/video.mp4',
        audioUrl: 'https://gcs.example.com/audio.mp3',
        durationSeconds: 90,
      });
      expect(capsule.status).toBe(CapsuleStatus.COMPLETED);
      expect(capsule.videoUrl).toBe('https://gcs.example.com/video.mp4');
    });

    it('throws when not in GENERATING_ASSETS or RENDERING', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(() => capsule.completeGeneration({})).toThrow(
        'Cannot complete generation',
      );
    });
  });

  // ── failGeneration ────────────────────────────────────────────────────────

  describe('failGeneration()', () => {
    it('transitions GENERATING_ASSETS → FAILED', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.startGeneration();
      capsule.failGeneration({ reason: 'ElevenLabs timeout' });
      expect(capsule.status).toBe(CapsuleStatus.FAILED);
      expect(capsule.isFailed()).toBe(true);
    });

    it('transitions RENDERING → FAILED', () => {
      const capsule = new Capsule({
        ...VALID_INPUT,
        type: CapsuleType.VIDEO,
      });
      capsule.startGeneration();
      capsule.startRendering();
      capsule.failGeneration({ reason: 'Shotstack render error' });
      expect(capsule.status).toBe(CapsuleStatus.FAILED);
    });

    it('throws when not in GENERATING_ASSETS or RENDERING', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(() => capsule.failGeneration()).toThrow(
        'Cannot mark generation as failed',
      );
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

    it('throws when updating from GENERATING_ASSETS status', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.startGeneration();
      expect(() => capsule.update({ title: 'New Title' })).toThrow(
        'Cannot update capsule',
      );
    });

    it('sets introText to null when empty string provided', () => {
      const capsule = new Capsule({ ...VALID_INPUT, introText: 'Old intro' });
      capsule.update({ introText: '' });
      expect(capsule.introText).toBeNull();
    });
  });

  // ── isVideoType / canGenerateVideo ─────────────────────────────────────────

  describe('isVideoType()', () => {
    it('returns true for VIDEO type', () => {
      const capsule = new Capsule({
        ...VALID_INPUT,
        type: CapsuleType.VIDEO,
      });
      expect(capsule.isVideoType()).toBe(true);
    });

    it('returns false for AUDIO type', () => {
      const capsule = new Capsule(VALID_INPUT);
      expect(capsule.isVideoType()).toBe(false);
    });
  });

  describe('canGenerateVideo()', () => {
    it('returns true for VIDEO capsule with valid scenes JSON in DRAFT', () => {
      const capsule = new Capsule({
        ...VALID_INPUT,
        type: CapsuleType.VIDEO,
      });
      capsule.updateScript(VIDEO_SCENES_JSON);
      expect(capsule.canGenerateVideo()).toBe(true);
    });

    it('returns false when capsule has no script', () => {
      const capsule = new Capsule({
        ...VALID_INPUT,
        type: CapsuleType.VIDEO,
      });
      expect(capsule.canGenerateVideo()).toBe(false);
    });

    it('returns false for AUDIO type even with script', () => {
      const capsule = new Capsule(VALID_INPUT);
      capsule.updateScript('A narrative script.');
      expect(capsule.canGenerateVideo()).toBe(false);
    });

    it('returns true when VIDEO capsule has a non-empty script (scene JSON validation is done in the use case)', () => {
      const capsule = new Capsule({
        ...VALID_INPUT,
        type: CapsuleType.VIDEO,
      });
      capsule.updateScript('plain text narrative — scene conversion happens in GenerateVideoUseCase');
      expect(capsule.canGenerateVideo()).toBe(true);
    });

    it('returns false when VIDEO capsule has no script', () => {
      const capsule = new Capsule({
        ...VALID_INPUT,
        type: CapsuleType.VIDEO,
      });
      expect(capsule.canGenerateVideo()).toBe(false);
    });
  });
});
