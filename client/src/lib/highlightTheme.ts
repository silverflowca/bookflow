import type React from 'react';

export type HighlightTheme = {
  bg: string;
  hover: string;
  border: string;
  text: string;
  swatchClass: string;
  softClass: string;
};

export const HIGHLIGHT_THEMES: Record<string, HighlightTheme> = {
  yellow: {
    bg: 'rgba(253, 230, 138, 0.55)',
    hover: 'rgba(253, 230, 138, 0.72)',
    border: 'rgba(250, 204, 21, 0.38)',
    text: '#854d0e',
    swatchClass: 'bg-amber-200',
    softClass: 'bg-amber-100',
  },
  green: {
    bg: 'rgba(187, 247, 208, 0.55)',
    hover: 'rgba(187, 247, 208, 0.72)',
    border: 'rgba(74, 222, 128, 0.38)',
    text: '#166534',
    swatchClass: 'bg-emerald-200',
    softClass: 'bg-emerald-100',
  },
  blue: {
    bg: 'rgba(191, 219, 254, 0.58)',
    hover: 'rgba(191, 219, 254, 0.75)',
    border: 'rgba(96, 165, 250, 0.38)',
    text: '#1d4ed8',
    swatchClass: 'bg-sky-200',
    softClass: 'bg-sky-100',
  },
  pink: {
    bg: 'rgba(251, 207, 232, 0.58)',
    hover: 'rgba(251, 207, 232, 0.75)',
    border: 'rgba(244, 114, 182, 0.38)',
    text: '#9d174d',
    swatchClass: 'bg-pink-200',
    softClass: 'bg-pink-100',
  },
};

export function getHighlightTheme(color?: string): HighlightTheme {
  if (!color) return HIGHLIGHT_THEMES.yellow;
  return HIGHLIGHT_THEMES[color] || {
    bg: color,
    hover: color,
    border: color,
    text: '#1f2937',
    swatchClass: 'bg-gray-200',
    softClass: 'bg-gray-100',
  };
}

export function getHighlightCssVars(color?: string): React.CSSProperties {
  const theme = getHighlightTheme(color);
  return {
    backgroundColor: theme.bg,
    ['--inline-highlight-bg' as any]: theme.bg,
    ['--inline-highlight-hover-bg' as any]: theme.hover,
  } as React.CSSProperties;
}
