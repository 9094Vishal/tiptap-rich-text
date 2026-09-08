# tiptap-react-editor

A configurable, production-ready React rich text editor built on [Tiptap](https://tiptap.dev/) v3 — formatting toolbar, tables, links, slash commands, `@` mentions, file uploads, emoji, and voice dictation, all switchable per-feature, plus a read-only `RichTextPreview` for rendering saved content elsewhere.

## Install

```bash
npm install tiptap-react-editor
```

`react` and `react-dom` (>=18) are peer dependencies — install them yourself if your project doesn't already have them.

## Quick start

```tsx
import { Editor } from 'tiptap-react-editor';
import 'tiptap-react-editor/styles.css';

function App() {
  const [html, setHtml] = useState('<p>Hello world</p>');
  return <Editor content={html} onChange={setHtml} />;
}
```

That's a fully-featured editor with every built-in tool on. Turn individual pieces off via `toolbarItems`, or opt into mentions/uploads/voice dictation as needed — see below.

## Features

- **Formatting** — bold, italic, underline, strike, headings (H1–H3), text color, highlight, text align, bullet/ordered lists with indent, blockquote, code block, horizontal rule, clear formatting
- **Links** — popover with URL + display text, autolink, link-on-paste
- **Tables** — visual grid insert, row/column add/delete, merge/split cells, header row/column toggle
- **Slash commands** — type `/` for a filtered menu of blocks (headings, lists, table, code, quote, image, attach file)
- **Mentions** — type `@`, backed by a static list or an async fetch function you provide
- **File uploads** — drag-drop, paste, or toolbar buttons; progress, retry-on-failure, remove; client-side validation (type/size/batch limits); optional deferred-upload mode
- **Emoji** — type `:` for a searchable shortcode menu, plus a full picker button
- **Voice dictation** — mic button using the Web Speech API, with browser-support fallback messaging
- **Fullscreen** — native `<dialog>`, no z-index fights with host app modals
- **Collapsible** — clamps to a single-line preview with a click-to-expand chevron
- **Theming** — every color/spacing token is a CSS custom property with a built-in light/dark default theme
- **`RichTextPreview`** — read-only renderer for saved HTML, with matching typography and click handlers for mentions/images/file chips
- **Extensible** — merge in your own Tiptap extensions (`extensions` prop) and toolbar buttons (`toolbarEnd` slot)
- **Draft autosave** — localStorage-backed, keyed by `draftKey`, debounced, restores on mount
- **Document diffing** — schema-aware comparison (`isUnchangedFrom` ref method, standalone `compareRichTextSnapshots`) that ignores incidental HTML re-serialization noise

## `<Editor>` props

### Content & behavior

| Prop | Type | Default | Description |
|---|---|---|---|
| `content` | `string` | `''` | Controlled HTML content. |
| `onChange` | `(html: string, text: string, editor: TiptapEditor) => void` | — | Fires on every document change. |
| `editable` | `boolean` | `true` | Set `false` for read-only mode. |
| `placeholder` | `string` | — | Placeholder shown when empty. |
| `className` | `string` | — | Extra class on the outer wrapper. |
| `error` | `string` | — | Renders an error border + message below the editor. |
| `autoFocus` | `boolean` | `false` | Focus the editor on mount. |
| `onBlur` | `(event: FocusEvent) => void` | — | |
| `onKeyDown` | `(event: KeyboardEvent) => void` | — | Not called while a suggestion popup (mention/slash/emoji) is open. |

### Toolbar

| Prop | Type | Default | Description |
|---|---|---|---|
| `hideToolbar` | `boolean` | `false` | Hides the toolbar outright. Ignored when `collapsible` is set. |
| `toolbarItems` | `Partial<ToolbarItems>` | all `true` | Per-feature switches — see below. |
| `enableSlashCommands` | `boolean` | `true` | The `/` command menu. |

`toolbarItems` keys (import `TOOLBAR_KEYS` for the string constants): `heading`, `bold`, `italic`, `underline`, `strike`, `clearFormatting`, `textColor`, `highlight`, `textAlign`, `lists`, `link`, `table`, `emoji`, `voiceDictation`, `codeBlock`, `blockquote`, `horizontalRule`, `fullscreen`. Every key defaults to `true`; pass e.g. `{ table: false, voiceDictation: false }` to turn just those off — everything else stays on.

### Collapse / expand

| Prop | Type | Default | Description |
|---|---|---|---|
| `collapsible` | `boolean` | `false` | When set, this owns toolbar visibility instead of `hideToolbar`. |
| `defaultExpanded` | `boolean` | `false` | Uncontrolled initial state. |
| `expanded` | `boolean` | — | Controlled state — overrides internal state when set. |
| `onExpandedChange` | `(expanded: boolean) => void` | — | |

### Mentions

| Prop | Type | Default | Description |
|---|---|---|---|
| `enableMentions` | `boolean` | `false` | |
| `mentionFetchFn` | `(query: string) => Promise<MentionItem[]>` | — | Debounced async lookup. Ignored when `mentionList` is set. |
| `mentionList` | `MentionItem[]` | — | Static list, filtered in-memory. Takes priority over `mentionFetchFn`. |
| `onMentionIds` | `(ids: Array<string \| number>) => void` | — | Fires with every mention id in the document, on each change. |
| `onMentionClick` | `(data: { id, label, event }) => void` | — | Fires when a mention chip is clicked while editing. |

`MentionItem` is `{ id: string \| number; value: string; avatar?: string }`.

### File uploads

| Prop | Type | Default | Description |
|---|---|---|---|
| `enableFileUpload` | `boolean` | `false` | |
| `onUploadRequest` | `(file: File, { onProgress, signal }) => Promise<UploadResult>` | — | Required when uploads are enabled — performs the actual upload. |
| `onUploadError` | `(file: File \| null, error: Error) => void` | — | `file` is `null` for batch-level errors (e.g. too many files at once). |
| `onPendingUploadsChange` | `(count: number) => void` | — | |
| `maxFileSizeMB` | `number` | `10` | |
| `acceptedFileTypes` | `string[]` | images/video/audio + common docs | Same shape as an `<input accept>` value. |
| `maxFilesPerBatch` | `number` | `10` | |
| `deferUploads` | `boolean` | `false` | Files are inserted inline immediately but held in memory only, uploaded when you call the `uploadStagedFiles()` ref method (i.e. at actual submit time). |

`UploadResult` is `{ id?: string; url: string; fileName?: string; fileSize?: number; mimeType?: string }`.

```tsx
<Editor
  enableFileUpload
  onUploadRequest={async (file, { onProgress, signal }) => {
    const url = await myUploadFn(file, { onProgress, signal });
    return { id: crypto.randomUUID(), url, fileName: file.name, fileSize: file.size, mimeType: file.type };
  }}
  onUploadError={(file, err) => toast.error(err.message)}
/>
```

### Draft autosave

| Prop | Type | Default | Description |
|---|---|---|---|
| `draftKey` | `string` | — | Enables localStorage-backed draft autosave under this key. On mount, an existing draft takes priority over `content` (meant for "unsent compose box" use cases, not content already saved elsewhere). |
| `onDraftStatusChange` | `(status: { hasDraft, draftValue, isDifferentFromContent }) => void` | — | Fires whenever the draft's presence/value changes. `isDifferentFromContent` is a document-model diff against `content` — use it to only show a "restore draft?" prompt when the draft is meaningfully different. |

Drafts are just an HTML string (typically a few KB), so they're stored in `localStorage` rather than IndexedDB — simpler, synchronous, and the right fit for this data shape. Writes are debounced (~500ms); a pending write is flushed on unmount so the last debounce window is never lost. Storage errors (quota exceeded, private browsing, disabled storage) degrade to a silent no-op rather than crashing the editor.

```tsx
<Editor
  draftKey={`message-${threadId}`}
  onDraftStatusChange={({ hasDraft, isDifferentFromContent }) => {
    if (hasDraft && isDifferentFromContent) showRestoreDraftBanner();
  }}
/>
```

## Extensibility

Beyond the `toolbarItems` on/off switches, you can add your own behavior:

**Custom Tiptap extensions** — pass any node, mark, or extension via the `extensions` prop. It's merged into the editor's own list:

```tsx
import { Extension } from '@tiptap/core';

const InsertSignature = Extension.create({
  name: 'insertSignature',
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-s': () => this.editor.commands.insertContent('— Sent from MyApp'),
    };
  },
});

// Define this once outside your component (or useMemo it) — a new array
// reference every render recreates the editor.
const extraExtensions = [InsertSignature];

<Editor extensions={extraExtensions} />;
```

If one of your extensions shares a name with a built-in one, yours wins — the same last-registered-wins rule Tiptap itself uses.

**Custom toolbar buttons** — render your own content at the end of the toolbar via `toolbarEnd`, which receives the live editor instance:

```tsx
<Editor
  toolbarEnd={(editor) => (
    <button title="Insert signature" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().insertContent('— Sent from MyApp').run()}>
      Signature
    </button>
  )}
/>
```

(`onMouseDown`'s `preventDefault()` matters — without it the button click steals focus from the editor first, the same way every built-in toolbar button handles it.)

## Imperative ref API

```tsx
const editorRef = useRef<EditorHandle>(null);
<Editor ref={editorRef} ... />
```

| Method | Description |
|---|---|
| `getHTML()` | Serialized HTML, or `''` when empty. |
| `getText()` | Plain text. |
| `isEmpty()` | Schema-aware emptiness check. |
| `focus()` | |
| `clear()` | Clears the document and its undo/redo history, and clears any stored draft. |
| `getInstance()` | Escape hatch to the underlying Tiptap `Editor` instance. |
| `getPendingUploadsCount()` | Uploads currently queued or in flight. |
| `getAttachments()` | Every successfully-uploaded attachment in the document. |
| `getAttachmentIds()` | |
| `getSessionUploadedIds()` | Ids uploaded this session, including ones since removed from the doc — diff against `getAttachmentIds()` at save time to find orphaned server-side files. |
| `uploadStagedFiles()` | Deferred-upload mode only — uploads every staged file, resolves to the final ids. Call before submitting. |
| `triggerImageUpload()` / `triggerFileUpload()` | Opens the native file picker programmatically. |
| `insertFiles(fileList)` | For a drop zone wider than the editor itself. |
| `saveDraftNow()` | Flushes the debounced draft write immediately (e.g. right before navigating away). No-op without `draftKey`. |
| `clearDraft()` | Deletes the stored draft. No-op without `draftKey`. |
| `hasDraft()` / `getDraftValue()` | |
| `isUnchangedFrom(html)` | Whether the live document is unchanged from the given baseline HTML — a document-model diff, not a string compare. Prefer this over comparing two HTML strings directly (e.g. to decide whether a "Save" button should be enabled). |

## Document diffing

Both `isUnchangedFrom` above (needs a mounted editor) and the standalone `compareRichTextSnapshots` (doesn't) diff at the document-model level — marks, node types, attributes — rather than as HTML text, so incidental re-serialization differences (attribute order, self-closing vs not, an old editor's markup for the same node) never register as a change. Only a difference a user could actually have made intentionally does.

```tsx
import { compareRichTextSnapshots } from 'tiptap-react-editor';

const unchanged = compareRichTextSnapshots(savedHtml, currentDraftHtml, {
  toolbarItems, // pass whatever this editor instance was configured with —
  enableMentions, // a schema built with different settings can't parse the
  enableFileUpload, // same HTML the same way
});
```

## `RichTextPreview`

Read-only renderer for HTML produced by `<Editor>` — same typography, working links, and click handlers for mentions/images/file attachments.

```tsx
import { RichTextPreview } from 'tiptap-react-editor';

<RichTextPreview
  content={savedHtml}
  emptyText="Nothing written yet."
  onMentionClick={({ id, label }) => openProfile(id)}
  onFileClick={({ url, fileName }) => openInAppViewer(url, fileName)}
/>
```

There's no built-in default action for a mention click — only your app knows what a mention id resolves to. Omit `onMentionClick` and chips are inert. Omit `onImageClick`/`onFileClick` and images/files fall back to opening in a new tab / their normal download link.

## Theming

Every color, spacing, and radius token is a CSS custom property scoped to `.rte-outer` (never `:root`, so the stylesheet can never leak into a host app's global scope). Override any of them by targeting `.rte-outer` with higher specificity:

```css
.rte-outer {
  --rte-accent: #7c3aed;
  --rte-radius: 10px;
}
```

Key tokens: `--rte-bg`, `--rte-text`, `--rte-text-muted`, `--rte-border`, `--rte-accent`, `--rte-toolbar-bg`, `--rte-btn-hover-bg`, `--rte-btn-active-bg`, `--rte-error`, `--rte-radius`. A dark theme applies automatically under `prefers-color-scheme: dark`; force one explicitly with `data-rte-theme="dark"` / `data-rte-theme="light"` on the `.rte-outer` element (or an ancestor).

## Development

```bash
npm install
npm run playground   # builds the package and starts the playground dev app
```

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## License

MIT
