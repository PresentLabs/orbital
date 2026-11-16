export type Theme = 'light' | 'dark';
export const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';
export function preferredTheme(value: unknown, cached: unknown = null): Theme {
  return isTheme(value) ? value : isTheme(cached) ? cached : 'light';
}
export function renderTheme(value: unknown, userId: string) {
  let cached: string | null = null;
  try { cached = localStorage.getItem('orbita:theme:' + userId); } catch {}
  const theme = preferredTheme(value, cached), root = document.documentElement;
  root.classList.toggle('theme-light', theme === 'light');
  root.classList.toggle('theme-dark', theme === 'dark');
  root.dataset.theme = theme; root.style.colorScheme = theme;
  document.querySelectorAll<HTMLButtonElement>('[data-appearance-mode]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.appearanceMode === theme));
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#ffffff' : '#141c17');
  try {
    localStorage.setItem('orbita:theme:' + userId, theme);
    localStorage.setItem('orbita:theme-user', userId);
  } catch {}
}
