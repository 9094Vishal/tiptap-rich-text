import { elementFromString, getSchema, type AnyExtension } from '@tiptap/core';
import { DOMParser as PMDOMParser } from '@tiptap/pm/model';
import { buildExtensions, type BuildExtensionsOptions } from './extensions';
import { mergeToolbarItems, type ToolbarItems } from './toolbarConfig';

// generateJSON()-style parsing uses ProseMirror's default whitespace
// collapsing, but the live editor is configured with `parseOptions: {
// preserveWhitespace: 'full' }` (see Editor.tsx), so it keeps things like
// a blank trailing paragraph or a run of spaces exactly as typed.
// Comparing against that default would report "changed" on every mount
// whenever the baseline HTML contained any such whitespace, even with
// zero edits — parse every baseline the same way the live editor does.
export const parseWithEditorWhitespaceRules = (html: string, extensions: AnyExtension[]) =>
  PMDOMParser.fromSchema(getSchema(extensions))
    .parse(elementFromString(html || ''), { preserveWhitespace: 'full' })
    .toJSON();

// Inert stand-ins for the callback-only parts of BuildExtensionsOptions —
// a headless diff never opens a suggestion popup or triggers an upload,
// it only needs the resulting *schema* (which nodes/marks exist), so
// these never actually run.
const buildSchemaOnlyExtensions = (options: DiffSchemaOptions): AnyExtension[] =>
  buildExtensions({
    toolbarItems: mergeToolbarItems(options.toolbarItems),
    enableSlashCommands: false,
    onSuggestionActiveChange: () => {},
    enableMentions: options.enableMentions ?? false,
    mentionFetchFnRef: { current: undefined },
    mentionListRef: { current: undefined },
    noResultsCacheRef: { current: new Set() },
    debounceTimerRef: { current: undefined },
    onLoadingChangeRef: { current: null },
    enableFileUpload: options.enableFileUpload ?? false,
    maxFileSizeMB: 0,
    acceptedFileTypes: [],
    maxFilesPerBatch: 0,
    onTriggerImageUpload: () => {},
    onTriggerFileUpload: () => {},
  } satisfies BuildExtensionsOptions);

export interface DiffSchemaOptions {
  /** Must match what the editor that produced these snapshots was
   *  configured with — a schema built with different toolbarItems/
   *  enableMentions/enableFileUpload can't parse the same HTML the same
   *  way. */
  toolbarItems?: Partial<ToolbarItems>;
  enableMentions?: boolean;
  enableFileUpload?: boolean;
}

/**
 * Headless "did the meaningful content change" check — no live editor
 * required, so this works wherever only two HTML snapshots are on hand
 * (e.g. comparing a persisted draft against the last-saved value while
 * the editor itself isn't mounted). Diffs at the document-model level
 * (marks, node types, attrs) rather than as HTML text, so incidental
 * re-serialization differences (attribute order, self-closing vs not,
 * an old editor's markup for the same node) never register as a change —
 * only a difference a user could actually have made intentionally does.
 */
export const compareRichTextSnapshots = (htmlA: string, htmlB: string, options: DiffSchemaOptions = {}): boolean => {
  const extensions = buildSchemaOnlyExtensions(options);
  try {
    return (
      JSON.stringify(parseWithEditorWhitespaceRules(htmlA, extensions)) ===
      JSON.stringify(parseWithEditorWhitespaceRules(htmlB, extensions))
    );
  } catch {
    // Unparseable snapshot — fail open to "different" rather than
    // silently hide a real change behind a comparison that couldn't run.
    return false;
  }
};
