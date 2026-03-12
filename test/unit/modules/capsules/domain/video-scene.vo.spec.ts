import {
  isVideoSceneArray,
  parseVideoScenes,
} from '../../../../../src/modules/capsules/domain/value-objects/video-scene.vo';

describe('VideoScene value object', () => {
  const VALID_SCENES = [
    {
      textToNarrate: 'Welcome to the company',
      visualPrompt: 'modern office building with glass facade',
      titleOverlay: 'Welcome',
    },
    {
      textToNarrate: 'Let us review the policies',
      visualPrompt: 'team meeting in a bright conference room',
      titleOverlay: 'Company Policies',
    },
  ];

  describe('isVideoSceneArray()', () => {
    it('returns true for a valid array of scenes', () => {
      expect(isVideoSceneArray(VALID_SCENES)).toBe(true);
    });

    it('returns false for an empty array', () => {
      expect(isVideoSceneArray([])).toBe(false);
    });

    it('returns false for a non-array', () => {
      expect(isVideoSceneArray('not an array')).toBe(false);
      expect(isVideoSceneArray(42)).toBe(false);
      expect(isVideoSceneArray(null)).toBe(false);
    });

    it('returns false when a required field is missing', () => {
      const missing = [{ textToNarrate: 'hi', visualPrompt: 'img' }];
      expect(isVideoSceneArray(missing)).toBe(false);
    });

    it('returns false when a field is not a string', () => {
      const badType = [
        { textToNarrate: 123, visualPrompt: 'img', titleOverlay: 'title' },
      ];
      expect(isVideoSceneArray(badType)).toBe(false);
    });
  });

  describe('parseVideoScenes()', () => {
    it('parses valid JSON into VideoScene[]', () => {
      const result = parseVideoScenes(JSON.stringify(VALID_SCENES));
      expect(result).toHaveLength(2);
      expect(result[0].textToNarrate).toBe('Welcome to the company');
    });

    it('throws on invalid JSON', () => {
      expect(() => parseVideoScenes('not json')).toThrow();
    });

    it('throws on valid JSON that is not a scene array', () => {
      expect(() => parseVideoScenes('[]')).toThrow('Invalid video script');
      expect(() => parseVideoScenes('"hello"')).toThrow('Invalid video script');
    });
  });
});
