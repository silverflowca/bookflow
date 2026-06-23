import { createContext, useContext } from 'react';

export type EditorPreviewMode = 'live' | 'minimal';

interface EditorPreviewCtx {
  mode: EditorPreviewMode;
}

export const EditorPreviewContext = createContext<EditorPreviewCtx>({ mode: 'live' });

export function useEditorPreviewMode(): EditorPreviewMode {
  return useContext(EditorPreviewContext).mode;
}
