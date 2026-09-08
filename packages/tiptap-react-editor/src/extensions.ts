import { StarterKit } from '@tiptap/starter-kit';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { ListItem } from '@tiptap/extension-list';
import { Link } from '@tiptap/extension-link';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extension-placeholder';
import type { AnyExtension } from '@tiptap/core';
import { TOOLBAR_KEYS, type ToolbarItems } from './toolbarConfig';
import { SlashCommands } from './SlashCommands';
import type { SlashCommandItem } from './SlashList';
import { createMentionExtension, type MentionFetchFn, type MentionItem } from './mentions';
import { AttachmentManager, type OnUploadError, type OnUploadRequest } from './attachments/AttachmentManager';
import { ImageAttachment } from './attachments/ImageAttachment';
import { FileAttachmentNode } from './attachments/FileAttachmentNode';
import { EmojiSuggestion } from './EmojiSuggestion';

// @tiptap/extension-link's Link mark defines `inclusive()` as a method that
// always returns `options.autolink` — that overrides any static
// `inclusive: false` passed to `Link.configure(...)`. With `inclusive`
// staying `true` (autolink is on), the mark extends across its own right
// boundary, so the cursor placed right after an autolinked/pasted URL is
// still "inside" the mark and anything typed next keeps inheriting the
// link. Hard-overriding `inclusive()` to `false` fixes that: new text
// typed immediately after a link no longer gets absorbed into it, while
// autolink/linkOnPaste keep working normally for the pasted URL itself.
const NonInclusiveLink = Link.extend({
  inclusive() {
    return false;
  },
});

export interface BuildExtensionsOptions {
  toolbarItems: ToolbarItems;
  placeholder?: string;
  enableSlashCommands: boolean;
  onSuggestionActiveChange: (active: boolean) => void;
  enableMentions: boolean;
  mentionFetchFnRef: { current: MentionFetchFn | undefined };
  mentionListRef: { current: MentionItem[] | undefined };
  noResultsCacheRef: { current: Set<string> };
  debounceTimerRef: { current: ReturnType<typeof setTimeout> | undefined };
  onLoadingChangeRef: { current: ((loading: boolean) => void) | null };
  enableFileUpload: boolean;
  onUploadRequest?: OnUploadRequest;
  onUploadError?: OnUploadError;
  maxFileSizeMB: number;
  acceptedFileTypes: string[];
  maxFilesPerBatch: number;
  onTriggerImageUpload: () => void;
  onTriggerFileUpload: () => void;
}

export const buildExtensions = ({
  toolbarItems,
  placeholder,
  enableSlashCommands,
  onSuggestionActiveChange,
  enableMentions,
  mentionFetchFnRef,
  mentionListRef,
  noResultsCacheRef,
  debounceTimerRef,
  onLoadingChangeRef,
  enableFileUpload,
  onUploadRequest,
  onUploadError,
  maxFileSizeMB,
  acceptedFileTypes,
  maxFilesPerBatch,
  onTriggerImageUpload,
  onTriggerFileUpload,
}: BuildExtensionsOptions): AnyExtension[] => [
  StarterKit.configure({
    heading: toolbarItems[TOOLBAR_KEYS.HEADING] ? { levels: [1, 2, 3] } : false,
    bold: toolbarItems[TOOLBAR_KEYS.BOLD] ? {} : false,
    italic: toolbarItems[TOOLBAR_KEYS.ITALIC] ? {} : false,
    strike: toolbarItems[TOOLBAR_KEYS.STRIKE] ? {} : false,
    codeBlock: toolbarItems[TOOLBAR_KEYS.CODE_BLOCK] ? {} : false,
    blockquote: toolbarItems[TOOLBAR_KEYS.BLOCKQUOTE] ? {} : false,
    horizontalRule: toolbarItems[TOOLBAR_KEYS.HORIZONTAL_RULE] ? {} : false,
    bulletList: toolbarItems[TOOLBAR_KEYS.LISTS] ? {} : false,
    orderedList: toolbarItems[TOOLBAR_KEYS.LISTS] ? {} : false,
    // Replaced below with a ListItem that also allows a heading as the
    // item's first block, so toggling a heading on inside a list item
    // doesn't force ProseMirror to lift it out of the list.
    listItem: false,
    // StarterKit bundles its own Link and Underline as of Tiptap v3 — both
    // are always disabled here and registered separately below instead
    // (conditionally on their toolbarItems flag, and in Link's case with
    // the non-inclusive fix). Leaving StarterKit's copies enabled caused a
    // duplicate-extension registration whose default config silently won
    // out over ours, and made `toolbarItems: { link: false }` a no-op.
    link: false,
    underline: false,
  }),
  ...(toolbarItems[TOOLBAR_KEYS.LISTS]
    ? [
        ListItem.extend({
          content: toolbarItems[TOOLBAR_KEYS.HEADING]
            ? '(paragraph | heading) block*'
            : 'paragraph block*',
        }),
      ]
    : []),
  ...(toolbarItems[TOOLBAR_KEYS.UNDERLINE] ? [Underline] : []),
  TextStyle,
  ...(toolbarItems[TOOLBAR_KEYS.TEXT_COLOR] ? [Color] : []),
  ...(toolbarItems[TOOLBAR_KEYS.HIGHLIGHT] ? [Highlight.configure({ multicolor: true })] : []),
  ...(toolbarItems[TOOLBAR_KEYS.TEXT_ALIGN]
    ? [TextAlign.configure({ types: ['heading', 'paragraph'] })]
    : []),
  ...(toolbarItems[TOOLBAR_KEYS.LINK]
    ? [
        NonInclusiveLink.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
        }),
      ]
    : []),
  ...(toolbarItems[TOOLBAR_KEYS.TABLE]
    ? [Table.configure({ resizable: true }), TableRow, TableHeader, TableCell]
    : []),
  Placeholder.configure({
    placeholder: ({ node }) => (node.type.name === 'heading' ? 'Heading…' : placeholder || ''),
  }),
  ...(enableFileUpload ? [ImageAttachment, FileAttachmentNode] : []),
  ...(enableSlashCommands
    ? [
        SlashCommands.configure({
          toolbarItems,
          onSuggestionActiveChange,
          extraItems: enableFileUpload ? buildUploadSlashItems({ onTriggerImageUpload, onTriggerFileUpload }) : [],
        }),
      ]
    : []),
  ...(enableMentions
    ? [
        createMentionExtension(
          { mentionFetchFnRef, mentionListRef, noResultsCacheRef, debounceTimerRef, onLoadingChangeRef },
          onSuggestionActiveChange
        ),
      ]
    : []),
  ...(toolbarItems[TOOLBAR_KEYS.EMOJI] ? [EmojiSuggestion.configure({ onSuggestionActiveChange })] : []),
  ...(enableFileUpload
    ? [
        AttachmentManager.configure({
          enabled: enableFileUpload,
          onUploadRequest: onUploadRequest ?? null,
          onUploadError: onUploadError ?? null,
          maxFileSizeMB,
          acceptedFileTypes,
          maxFilesPerBatch,
        }),
      ]
    : []),
];

const buildUploadSlashItems = ({
  onTriggerImageUpload,
  onTriggerFileUpload,
}: {
  onTriggerImageUpload: () => void;
  onTriggerFileUpload: () => void;
}): SlashCommandItem[] => [
  {
    title: 'Image',
    description: 'Upload an image',
    icon: 'IMG',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      onTriggerImageUpload();
    },
  },
  {
    title: 'Attach file',
    description: 'Upload any file',
    icon: 'FILE',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      onTriggerFileUpload();
    },
  },
];
