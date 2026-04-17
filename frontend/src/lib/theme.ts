export const THEME_STORAGE_KEY = 'noted-theme';

export type Theme = 'light' | 'dark';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

export function resolveStoredTheme(value: string | null): Theme | null {
  return isTheme(value) ? value : null;
}

export function resolveInitialTheme(
  storedTheme: string | null,
  prefersDark: boolean,
): Theme {
  return resolveStoredTheme(storedTheme) ?? (prefersDark ? 'dark' : 'light');
}
