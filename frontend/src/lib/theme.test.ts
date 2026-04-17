import { describe, expect, it } from 'vitest';

import { resolveInitialTheme, resolveStoredTheme } from './theme';

describe('theme helpers', () => {
  it('keeps explicit stored themes', () => {
    expect(resolveStoredTheme('dark')).toBe('dark');
    expect(resolveStoredTheme('light')).toBe('light');
  });

  it('ignores invalid stored theme values', () => {
    expect(resolveStoredTheme('system')).toBeNull();
    expect(resolveStoredTheme(null)).toBeNull();
  });

  it('falls back to system preference when no stored theme exists', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark');
    expect(resolveInitialTheme(null, false)).toBe('light');
  });
});
