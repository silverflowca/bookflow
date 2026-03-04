import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Color scheme definitions - 14 light and 14 dark themes
export const colorSchemes = {
  // ===== LIGHT THEMES (High Contrast) =====
  'light-purple': {
    name: 'Lavender',
    mode: 'light',
    primary: { h: 270, s: 76, l: 55 },
    accent: '#9333ea',
    bg: '#faf5ff',
    surface: '#ffffff',
    surfaceHover: '#f3e8ff',
    border: '#d8b4fe',
    borderStrong: '#a855f7',
    text: '#1f2937',
    textMuted: '#6b7280',
  },
  'light-blue': {
    name: 'Ocean',
    mode: 'light',
    primary: { h: 217, s: 91, l: 60 },
    accent: '#3b82f6',
    bg: '#eff6ff',
    surface: '#ffffff',
    surfaceHover: '#dbeafe',
    border: '#93c5fd',
    borderStrong: '#3b82f6',
    text: '#1f2937',
    textMuted: '#6b7280',
  },
  'light-green': {
    name: 'Forest',
    mode: 'light',
    primary: { h: 142, s: 71, l: 45 },
    accent: '#22c55e',
    bg: '#f0fdf4',
    surface: '#ffffff',
    surfaceHover: '#dcfce7',
    border: '#86efac',
    borderStrong: '#22c55e',
    text: '#1f2937',
    textMuted: '#6b7280',
  },
  'light-amber': {
    name: 'Sunset',
    mode: 'light',
    primary: { h: 38, s: 92, l: 50 },
    accent: '#f59e0b',
    bg: '#fffbeb',
    surface: '#ffffff',
    surfaceHover: '#fef3c7',
    border: '#fcd34d',
    borderStrong: '#f59e0b',
    text: '#1f2937',
    textMuted: '#6b7280',
  },
  'light-rose': {
    name: 'Blossom',
    mode: 'light',
    primary: { h: 350, s: 89, l: 60 },
    accent: '#f43f5e',
    bg: '#fff1f2',
    surface: '#ffffff',
    surfaceHover: '#ffe4e6',
    border: '#fda4af',
    borderStrong: '#f43f5e',
    text: '#1f2937',
    textMuted: '#6b7280',
  },
  'light-cyan': {
    name: 'Arctic',
    mode: 'light',
    primary: { h: 186, s: 94, l: 41 },
    accent: '#06b6d4',
    bg: '#ecfeff',
    surface: '#ffffff',
    surfaceHover: '#cffafe',
    border: '#67e8f9',
    borderStrong: '#06b6d4',
    text: '#1f2937',
    textMuted: '#6b7280',
  },
  'light-neutral': {
    name: 'Classic',
    mode: 'light',
    primary: { h: 220, s: 13, l: 46 },
    accent: '#64748b',
    bg: '#f8fafc',
    surface: '#ffffff',
    surfaceHover: '#f1f5f9',
    border: '#cbd5e1',
    borderStrong: '#64748b',
    text: '#1f2937',
    textMuted: '#6b7280',
  },

  // ===== LIGHT THEMES (Soft/Low Contrast) =====
  'soft-lavender': {
    name: 'Soft Lavender',
    mode: 'light',
    primary: { h: 270, s: 40, l: 65 },
    accent: '#a78bfa',
    bg: '#fdfcff',
    surface: '#ffffff',
    surfaceHover: '#f5f3ff',
    border: '#e9e5f5',
    borderStrong: '#c4b5fd',
    text: '#374151',
    textMuted: '#9ca3af',
  },
  'soft-sky': {
    name: 'Soft Sky',
    mode: 'light',
    primary: { h: 200, s: 45, l: 60 },
    accent: '#7dd3fc',
    bg: '#f9fdff',
    surface: '#ffffff',
    surfaceHover: '#f0f9ff',
    border: '#e0f2fe',
    borderStrong: '#bae6fd',
    text: '#374151',
    textMuted: '#9ca3af',
  },
  'soft-sage': {
    name: 'Soft Sage',
    mode: 'light',
    primary: { h: 150, s: 30, l: 55 },
    accent: '#86efac',
    bg: '#f9fdfb',
    surface: '#ffffff',
    surfaceHover: '#f0fdf4',
    border: '#dcfce7',
    borderStrong: '#bbf7d0',
    text: '#374151',
    textMuted: '#9ca3af',
  },
  'soft-peach': {
    name: 'Soft Peach',
    mode: 'light',
    primary: { h: 25, s: 70, l: 70 },
    accent: '#fdba74',
    bg: '#fffdfb',
    surface: '#ffffff',
    surfaceHover: '#fff7ed',
    border: '#fed7aa',
    borderStrong: '#fdba74',
    text: '#374151',
    textMuted: '#9ca3af',
  },
  'soft-blush': {
    name: 'Soft Blush',
    mode: 'light',
    primary: { h: 340, s: 50, l: 75 },
    accent: '#fda4af',
    bg: '#fffbfc',
    surface: '#ffffff',
    surfaceHover: '#fff1f2',
    border: '#fecdd3',
    borderStrong: '#fda4af',
    text: '#374151',
    textMuted: '#9ca3af',
  },
  'soft-mint': {
    name: 'Soft Mint',
    mode: 'light',
    primary: { h: 175, s: 40, l: 55 },
    accent: '#5eead4',
    bg: '#f9fffe',
    surface: '#ffffff',
    surfaceHover: '#f0fdfa',
    border: '#ccfbf1',
    borderStrong: '#99f6e4',
    text: '#374151',
    textMuted: '#9ca3af',
  },
  'soft-stone': {
    name: 'Soft Stone',
    mode: 'light',
    primary: { h: 30, s: 10, l: 55 },
    accent: '#a8a29e',
    bg: '#fafaf9',
    surface: '#ffffff',
    surfaceHover: '#f5f5f4',
    border: '#e7e5e4',
    borderStrong: '#d6d3d1',
    text: '#44403c',
    textMuted: '#a8a29e',
  },

  // ===== DARK THEMES (High Contrast) =====
  'dark-purple': {
    name: 'Midnight Violet',
    mode: 'dark',
    primary: { h: 270, s: 76, l: 55 },
    accent: '#a855f7',
    bg: '#0f0a1a',
    surface: '#1a1025',
    surfaceHover: '#2d1f45',
    border: '#3b2663',
    borderStrong: '#7c3aed',
    text: '#f3f4f6',
    textMuted: '#9ca3af',
  },
  'dark-blue': {
    name: 'Deep Ocean',
    mode: 'dark',
    primary: { h: 217, s: 91, l: 60 },
    accent: '#60a5fa',
    bg: '#0a0f1a',
    surface: '#111827',
    surfaceHover: '#1e3a5f',
    border: '#1e3a5f',
    borderStrong: '#3b82f6',
    text: '#f3f4f6',
    textMuted: '#9ca3af',
  },
  'dark-green': {
    name: 'Emerald Night',
    mode: 'dark',
    primary: { h: 142, s: 71, l: 45 },
    accent: '#4ade80',
    bg: '#0a1a0f',
    surface: '#0d1f12',
    surfaceHover: '#14532d',
    border: '#166534',
    borderStrong: '#22c55e',
    text: '#f3f4f6',
    textMuted: '#9ca3af',
  },
  'dark-amber': {
    name: 'Golden Dusk',
    mode: 'dark',
    primary: { h: 38, s: 92, l: 50 },
    accent: '#fbbf24',
    bg: '#1a150a',
    surface: '#1f1a0f',
    surfaceHover: '#422006',
    border: '#78350f',
    borderStrong: '#f59e0b',
    text: '#f3f4f6',
    textMuted: '#9ca3af',
  },
  'dark-rose': {
    name: 'Crimson Night',
    mode: 'dark',
    primary: { h: 350, s: 89, l: 60 },
    accent: '#fb7185',
    bg: '#1a0a0c',
    surface: '#1f0f11',
    surfaceHover: '#4c0519',
    border: '#881337',
    borderStrong: '#f43f5e',
    text: '#f3f4f6',
    textMuted: '#9ca3af',
  },
  'dark-cyan': {
    name: 'Northern Lights',
    mode: 'dark',
    primary: { h: 186, s: 94, l: 41 },
    accent: '#22d3ee',
    bg: '#0a1a1a',
    surface: '#0f1f1f',
    surfaceHover: '#083344',
    border: '#0e7490',
    borderStrong: '#06b6d4',
    text: '#f3f4f6',
    textMuted: '#9ca3af',
  },
  'dark-neutral': {
    name: 'Charcoal',
    mode: 'dark',
    primary: { h: 220, s: 13, l: 46 },
    accent: '#94a3b8',
    bg: '#0f1115',
    surface: '#18181b',
    surfaceHover: '#27272a',
    border: '#3f3f46',
    borderStrong: '#71717a',
    text: '#f3f4f6',
    textMuted: '#9ca3af',
  },

  // ===== DARK THEMES (Soft/Low Contrast) =====
  'muted-violet': {
    name: 'Muted Violet',
    mode: 'dark',
    primary: { h: 270, s: 30, l: 50 },
    accent: '#a78bfa',
    bg: '#1c1a24',
    surface: '#242231',
    surfaceHover: '#2e2b3d',
    border: '#3d3a4d',
    borderStrong: '#6d6a80',
    text: '#e8e6ee',
    textMuted: '#a09cad',
  },
  'muted-ocean': {
    name: 'Muted Ocean',
    mode: 'dark',
    primary: { h: 210, s: 35, l: 50 },
    accent: '#7dd3fc',
    bg: '#1a1e24',
    surface: '#212831',
    surfaceHover: '#2a333d',
    border: '#3a4552',
    borderStrong: '#5a6a7a',
    text: '#e6eaee',
    textMuted: '#9ca8b4',
  },
  'muted-forest': {
    name: 'Muted Forest',
    mode: 'dark',
    primary: { h: 150, s: 25, l: 45 },
    accent: '#86efac',
    bg: '#1a1f1c',
    surface: '#212824',
    surfaceHover: '#2a332d',
    border: '#3a4540',
    borderStrong: '#5a6a60',
    text: '#e6eee8',
    textMuted: '#9cada0',
  },
  'muted-copper': {
    name: 'Muted Copper',
    mode: 'dark',
    primary: { h: 25, s: 40, l: 50 },
    accent: '#fdba74',
    bg: '#1f1c1a',
    surface: '#282421',
    surfaceHover: '#332e2a',
    border: '#453f3a',
    borderStrong: '#6a635a',
    text: '#eee8e6',
    textMuted: '#ada59c',
  },
  'muted-wine': {
    name: 'Muted Wine',
    mode: 'dark',
    primary: { h: 340, s: 30, l: 50 },
    accent: '#fda4af',
    bg: '#1f1a1c',
    surface: '#282224',
    surfaceHover: '#332a2d',
    border: '#453a3d',
    borderStrong: '#6a5a5f',
    text: '#eee6e8',
    textMuted: '#ad9ca2',
  },
  'muted-teal': {
    name: 'Muted Teal',
    mode: 'dark',
    primary: { h: 175, s: 30, l: 45 },
    accent: '#5eead4',
    bg: '#1a1f1e',
    surface: '#212826',
    surfaceHover: '#2a3330',
    border: '#3a4542',
    borderStrong: '#5a6a65',
    text: '#e6eeed',
    textMuted: '#9cadaa',
  },
  'muted-slate': {
    name: 'Muted Slate',
    mode: 'dark',
    primary: { h: 220, s: 15, l: 50 },
    accent: '#94a3b8',
    bg: '#1a1c1f',
    surface: '#22252a',
    surfaceHover: '#2c3035',
    border: '#3c4148',
    borderStrong: '#5c636d',
    text: '#e6e8eb',
    textMuted: '#9ca1a8',
  },
} as const;

export type ColorSchemeKey = keyof typeof colorSchemes;

interface ThemeContextType {
  colorScheme: ColorSchemeKey;
  setColorScheme: (scheme: ColorSchemeKey) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorSchemeKey>(() => {
    const saved = localStorage.getItem('bookflow-color-scheme');
    return (saved as ColorSchemeKey) || 'light-purple';
  });

  const setColorScheme = (scheme: ColorSchemeKey) => {
    setColorSchemeState(scheme);
    localStorage.setItem('bookflow-color-scheme', scheme);
  };

  // Apply theme CSS variables
  useEffect(() => {
    const scheme = colorSchemes[colorScheme];
    const root = document.documentElement;

    // Set CSS variables
    root.style.setProperty('--color-bg', scheme.bg);
    root.style.setProperty('--color-surface', scheme.surface);
    root.style.setProperty('--color-surface-hover', scheme.surfaceHover);
    root.style.setProperty('--color-border', scheme.border);
    root.style.setProperty('--color-border-strong', scheme.borderStrong);
    root.style.setProperty('--color-text', scheme.text);
    root.style.setProperty('--color-text-muted', scheme.textMuted);
    root.style.setProperty('--color-accent', scheme.accent);
    root.style.setProperty('--color-primary-h', String(scheme.primary.h));
    root.style.setProperty('--color-primary-s', `${scheme.primary.s}%`);
    root.style.setProperty('--color-primary-l', `${scheme.primary.l}%`);

    // Add/remove dark mode class
    if (scheme.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [colorScheme]);

  const isDark = colorSchemes[colorScheme].mode === 'dark';

  return (
    <ThemeContext.Provider value={{ colorScheme, setColorScheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
