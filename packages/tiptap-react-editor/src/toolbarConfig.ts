/**
 * Single source of truth for every feature this editor knows how to turn
 * on/off. Shared by extension registration (extensions.ts) and toolbar
 * rendering (Toolbar.tsx) so a renamed/added key can't silently drift out
 * of sync between the two.
 */
export const TOOLBAR_KEYS = {
  HEADING: 'heading',
  BOLD: 'bold',
  ITALIC: 'italic',
  UNDERLINE: 'underline',
  STRIKE: 'strike',
  CLEAR_FORMATTING: 'clearFormatting',
  TEXT_COLOR: 'textColor',
  HIGHLIGHT: 'highlight',
  TEXT_ALIGN: 'textAlign',
  LISTS: 'lists',
  LINK: 'link',
  TABLE: 'table',
  EMOJI: 'emoji',
  VOICE_DICTATION: 'voiceDictation',
  CODE_BLOCK: 'codeBlock',
  BLOCKQUOTE: 'blockquote',
  HORIZONTAL_RULE: 'horizontalRule',
  FULLSCREEN: 'fullscreen',
} as const;

export type ToolbarKey = (typeof TOOLBAR_KEYS)[keyof typeof TOOLBAR_KEYS];

export type ToolbarItems = Record<ToolbarKey, boolean>;

// Every key defaults to enabled, so an unset `toolbarItems` prop (or a
// partial override) keeps every feature on unless explicitly turned off.
export const DEFAULT_TOOLBAR_ITEMS: ToolbarItems = Object.fromEntries(
  Object.values(TOOLBAR_KEYS).map((key) => [key, true])
) as ToolbarItems;

export const mergeToolbarItems = (
  toolbarItems?: Partial<ToolbarItems>
): ToolbarItems => ({
  ...DEFAULT_TOOLBAR_ITEMS,
  ...toolbarItems,
});
