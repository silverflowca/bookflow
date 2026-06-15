# BookFlow → React Native Conversion Plan

> Generated: 2026-06-10

## Overview

BookFlow is a substantial app: 26 screens, 60+ components, 23 API route modules, 90+ API methods, a rich-text editor, live streaming, and an extensive theming system. This is a **large, multi-phase project** — not a simple port.

---

## Scope Assessment

| Category | Web | RN Equivalent | Difficulty |
|---|---|---|---|
| Screens/Pages | 26 React Router pages | 26 RN screens | Medium |
| Components | 60+ Tailwind components | Rewrite w/ StyleSheet/NativeWind | Medium |
| Rich Text Editor | TipTap (ProseMirror) | **No direct equivalent** | **Critical** |
| Theming (28 themes) | CSS variables | Context + StyleSheet | Medium |
| Auth | Supabase JS + JWT | Same SDK works | Easy |
| API Client | Fetch-based class | Reuse almost as-is | Easy |
| File Upload | HTML input + Multer | `expo-document-picker` | Medium |
| Chat / Live | REST polling | Same + WebSocket | Medium |
| Live Streaming | Restream web embeds | **No direct equivalent** | Hard |
| Export (EPUB/DOCX/PDF) | Server-side only | Server stays the same | Easy |
| TTS | REST API | Same | Easy |
| Notifications | In-app inbox | + Push notifications | Medium |
| Navigation | React Router v6 | React Navigation | Easy |
| Local storage | `localStorage` | `AsyncStorage` | Easy |

---

## Architecture Decision: Expo vs Bare React Native

**Recommendation: Expo (Managed → Bare as needed)**

- Faster start, OTA updates, handles native build complexity
- Expo SDK covers: camera, audio, file system, notifications, document picker
- Eject to bare if Restream or streaming integrations require native modules

---

## Phase Breakdown

### Phase 1 — Foundation & Setup *(~1 week)*
**Effort: Low — Medium**

- Initialize new `bookflow-mobile/` folder using Expo
- Configure TypeScript, ESLint, path aliases
- Set up React Navigation (Stack + Tab + Drawer)
- Port `AuthContext` — Supabase JS SDK works in RN
- Port `ThemeContext` — replace CSS variables with RN `StyleSheet` + Context
- Create NativeWind config (mirrors Tailwind utility classes)
- Port `lib/api.ts` (API client) — almost zero changes needed
- Port all TypeScript `types/` — zero changes needed
- Set up environment variables via `expo-constants`

**Output:** Blank app that authenticates and calls the API.

---

### Phase 2 — Core Screens (Read-only) *(~2 weeks)*
**Effort: Medium**

Port all "consumer" screens first (no editor):

- `Login.tsx` / `Register.tsx`
- `Dashboard.tsx` — book list cards
- `BookReader.tsx` — read chapters, inline content rendering
- `PublicBookPage.tsx`
- `ProfilePage.tsx`
- `ClubsPage.tsx` / `ClubDetailPage.tsx`
- `InboxPage.tsx`
- `Settings.tsx`

Key work:
- Build NativeWind-based component primitives (Button, Card, Modal, Badge, etc.)
- Build inline content renderers: question, poll, highlight, note, image, scripture, code block
- Replace HTML/DOM with RN primitives: `<ScrollView>`, `<FlatList>`, `<Pressable>`, `<Image>`

---

### Phase 3 — Rich Text Editor *(~2–3 weeks)*
**Effort: Very High — this is the hardest part**

TipTap uses the DOM and **cannot run in React Native**. Options:

| Option | Pros | Cons |
|---|---|---|
| **`@10play/tentap-editor`** | TipTap port for RN, most feature parity | Newer library, less mature |
| **Lexical with WebView bridge** | Facebook-backed, battle-tested | Complex bridge code |
| **Custom WebView (embed TipTap in WebView)** | Reuse existing web editor | Poor native feel, input lag |
| **Simpler custom editor** | Full control | Weeks of development |

**Recommendation:** Use `@10play/tentap-editor` (React Native TipTap wrapper). It covers headings, bold, italic, lists, links, and can be extended for custom nodes.

**Custom work required regardless:**
- Port `InlineFormNode`, `ColumnLayoutNode` (TipTap custom nodes) to RN equivalents
- Inline content panel (questions, polls, images, etc.) must be rebuilt as RN sheet/modal
- Chapter save/autosave logic

---

### Phase 4 — Collaboration & Comments *(~1 week)*
**Effort: Medium**

- `BookCollaboratorsPage.tsx` — invite flow, role badges
- `CommentThread`, `CommentsSidebar` — threaded comments
- `ReviewBanner` — review request workflow
- `BookVersionsPage.tsx` — version history list + restore
- `BookActivityPage.tsx` — audit trail

These are mostly list/card UIs — straightforward to port.

---

### Phase 5 — Book Clubs & Chat *(~1 week)*
**Effort: Medium**

- `ClubReadPage.tsx` — group reading with chat sidebar
- `ClubChatPanel` — real-time chat (REST polling → consider WebSocket upgrade)
- `ChatInput`, `ChatMessageList`, `ChatAudioRecorder`
- `ChatSettingsModal`
- Audio recording: `expo-av` for `ChatAudioRecorder`

---

### Phase 6 — Live Streaming *(~2 weeks)*
**Effort: High**

- `LiveSchedule.tsx`, `LiveEpisode.tsx`, `LiveDashboard.tsx`, `LiveQueue.tsx`, `LiveBible.tsx`
- Restream integration: web embeds won't work natively
  - Option A: Embed Restream web dashboard in `WebView` (pragmatic, lower quality)
  - Option B: Use Restream API + `react-native-live-stream` or similar (proper, complex)
- Bible search: straightforward list UI
- Live chat: same WebSocket/polling approach as Club Chat
- Slide deck management: custom carousel/list component

---

### Phase 7 — Publishing & Export *(~3 days)*
**Effort: Low**

- `PublishSubmitPage.tsx` — forms + API calls
- Export flows: server-side (EPUB, DOCX, PDF) — just trigger download
  - Use `expo-sharing` + `expo-file-system` to download and share generated files
- `BookSettings.tsx`, `BookVersionsPage.tsx` — settings forms

---

### Phase 8 — Push Notifications & Polish *(~1 week)*
**Effort: Medium**

- Add `expo-notifications` for push notification support
- Map existing in-app inbox notifications to push
- Offline support: `@tanstack/react-query` for caching + optimistic updates
- Deep linking for invite accept flows
- App icons, splash screens, store metadata prep

---

## What Stays on the Server (No RN Changes)

The Express.js backend requires **zero changes**:
- PDF/EPUB/DOCX generation (Puppeteer, epub-gen, docx)
- File storage (Supabase)
- Email (Nodemailer)
- Auth (JWT)
- All 23 API route modules

---

## Reusable Code (High)

| Module | Reuse % |
|---|---|
| `lib/api.ts` (API client) | ~95% — just swap `fetch` base URL |
| `types/` (TypeScript interfaces) | 100% |
| `contexts/AuthContext.tsx` | ~80% |
| Server (all routes) | 100% |
| Business logic in hooks | ~60–70% |

---

## Effort Summary

| Phase | Description | Estimated Effort |
|---|---|---|
| 1 | Foundation & Auth | 1 week |
| 2 | Core Read-only Screens | 2 weeks |
| 3 | Rich Text Editor | 2–3 weeks |
| 4 | Collaboration & Comments | 1 week |
| 5 | Clubs & Chat | 1 week |
| 6 | Live Streaming | 2 weeks |
| 7 | Publishing & Export | 3 days |
| 8 | Notifications & Polish | 1 week |
| **Total** | | **~11–13 weeks (solo dev)** |

---

## Critical Risks

1. **TipTap editor** — biggest unknown. `@10play/tentap-editor` may not support all custom nodes (ColumnLayout, InlineForm). Budget extra 1–2 weeks if custom nodes need full RN rebuilds.

2. **Live streaming** — Restream embed in WebView is pragmatic but feels like a web app. A proper native integration requires significant research.

3. **28-theme system** — CSS variables have no direct RN equivalent. The Theme Context + StyleSheet approach works but requires touching every styled component.

4. **Platform review** — Apple App Store review for apps with in-app reading/publishing content can be slow (especially with subscription/payment implications if monetized later).

---

## Recommended Approach: Brownfield / Parallel

Rather than a big-bang rewrite, consider:

1. **Expo monorepo** alongside the existing web app (share `types/`, `lib/api.ts`, contexts)
2. Ship Phase 1–2 as MVP (reader + auth + clubs)
3. Add editor (Phase 3) as v1.1
4. Live streaming (Phase 6) as v2.0

This lets you ship something usable in ~3–4 weeks while the complex phases continue.
