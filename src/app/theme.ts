export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'theme'
const THEME_COLOR: Record<Theme, string> = { dark: '#0b0f14', light: '#f6f8fa' }

export function currentTheme(root: HTMLElement): Theme {
  return root.classList.contains('light') ? 'light' : 'dark'
}

function remember(theme: Theme): void {
  try {
    if (theme === 'light') localStorage.setItem(STORAGE_KEY, 'light')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Blocked storage still lets the theme apply to this page.
  }
}

export function toggleTheme(document: Document): Theme {
  const root = document.documentElement
  const next: Theme = currentTheme(root) === 'light' ? 'dark' : 'light'
  root.classList.toggle('light', next === 'light')
  remember(next)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[next])
  return next
}
