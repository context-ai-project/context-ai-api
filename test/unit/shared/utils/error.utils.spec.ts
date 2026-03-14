import {
  extractErrorMessage,
  extractErrorStack,
} from '../../../../src/shared/utils/error.utils';

describe('extractErrorMessage', () => {
  it('returns the message from an Error instance', () => {
    expect(extractErrorMessage(new Error('Something went wrong'))).toBe(
      'Something went wrong',
    );
  });

  it('returns "Unknown error" for non-Error values', () => {
    expect(extractErrorMessage(null)).toBe('Unknown error');
    expect(extractErrorMessage(undefined)).toBe('Unknown error');
    expect(extractErrorMessage('raw string')).toBe('Unknown error');
    expect(extractErrorMessage(42)).toBe('Unknown error');
    expect(extractErrorMessage({ message: 'object' })).toBe('Unknown error');
  });

  it('returns the message for subclasses of Error', () => {
    expect(extractErrorMessage(new TypeError('bad type'))).toBe('bad type');
    expect(extractErrorMessage(new RangeError('out of range'))).toBe('out of range');
  });
});

describe('extractErrorStack', () => {
  it('returns the stack from an Error instance', () => {
    const err = new Error('stack test');
    expect(extractErrorStack(err)).toBe(err.stack);
  });

  it('returns undefined for non-Error values', () => {
    expect(extractErrorStack(null)).toBeUndefined();
    expect(extractErrorStack('raw')).toBeUndefined();
    expect(extractErrorStack(0)).toBeUndefined();
  });
});
