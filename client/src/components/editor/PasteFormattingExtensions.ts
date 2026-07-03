import { Extension } from '@tiptap/core';
import type { CSSProperties } from 'react';

const ALLOWED_FONT_FAMILIES = [
  'Arial',
  'Calibri',
  'Cambria',
  'Georgia',
  'Helvetica',
  'Times New Roman',
  'Verdana',
];

function sanitizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const color = value.trim();
  if (
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(color)
  ) {
    return color;
  }
  return null;
}

function sanitizeFontSize(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(px|pt|em|rem)$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 8 || amount > 96) return null;
  return `${amount}${match[2].toLowerCase()}`;
}

function sanitizeFontFamily(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const firstFamily = value
    .split(',')
    .map(part => part.trim().replace(/^["']|["']$/g, ''))
    .find(Boolean);

  if (!firstFamily) return null;
  const allowed = ALLOWED_FONT_FAMILIES.find(font => font.toLowerCase() === firstFamily.toLowerCase());
  return allowed || null;
}

function sanitizeTextAlign(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const align = value.trim().toLowerCase();
  return ['left', 'center', 'right', 'justify'].includes(align) ? align : null;
}

export const PasteFormatting = Extension.create({
  name: 'pasteFormatting',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          color: {
            default: null,
            parseHTML: element => sanitizeColor((element as HTMLElement).style.color),
            renderHTML: attributes => {
              const color = sanitizeColor(attributes.color);
              return color ? { style: `color: ${color}` } : {};
            },
          },
          fontSize: {
            default: null,
            parseHTML: element => sanitizeFontSize((element as HTMLElement).style.fontSize),
            renderHTML: attributes => {
              const fontSize = sanitizeFontSize(attributes.fontSize);
              return fontSize ? { style: `font-size: ${fontSize}` } : {};
            },
          },
          fontFamily: {
            default: null,
            parseHTML: element => sanitizeFontFamily((element as HTMLElement).style.fontFamily),
            renderHTML: attributes => {
              const fontFamily = sanitizeFontFamily(attributes.fontFamily);
              return fontFamily ? { style: `font-family: ${fontFamily}` } : {};
            },
          },
        },
      },
      {
        types: ['paragraph', 'heading'],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: element => (
              sanitizeTextAlign((element as HTMLElement).style.textAlign) ||
              sanitizeTextAlign(element.getAttribute('align'))
            ),
            renderHTML: attributes => {
              const textAlign = sanitizeTextAlign(attributes.textAlign);
              return textAlign ? { style: `text-align: ${textAlign}` } : {};
            },
          },
        },
      },
    ];
  },
});

export function getTextStyleAttributes(attrs: Record<string, unknown> | undefined): CSSProperties {
  return {
    color: sanitizeColor(attrs?.color) || undefined,
    fontSize: sanitizeFontSize(attrs?.fontSize) || undefined,
    fontFamily: sanitizeFontFamily(attrs?.fontFamily) || undefined,
  };
}

export function getTextAlignStyle(attrs: Record<string, unknown> | undefined): CSSProperties {
  return {
    textAlign: sanitizeTextAlign(attrs?.textAlign) as CSSProperties['textAlign'] | undefined,
  };
}

export function getTextStyleCss(attrs: Record<string, unknown> | undefined): string {
  const styles = [
    ['color', sanitizeColor(attrs?.color)],
    ['font-size', sanitizeFontSize(attrs?.fontSize)],
    ['font-family', sanitizeFontFamily(attrs?.fontFamily)],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return styles.map(([name, value]) => `${name}:${value}`).join(';');
}

export function getTextAlignCss(attrs: Record<string, unknown> | undefined): string {
  const textAlign = sanitizeTextAlign(attrs?.textAlign);
  return textAlign ? `text-align:${textAlign}` : '';
}
