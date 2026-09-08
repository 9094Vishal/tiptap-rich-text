import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { EditorContent, useEditor, type Editor as TiptapEditor } from '@tiptap/react';
import type { AnyExtension, JSONContent } from '@tiptap/core';
import { buildExtensions } from './extensions';
import { Toolbar } from './Toolbar';
import { TOOLBAR_KEYS, mergeToolbarItems, type ToolbarItems } from './toolbarConfig';
import { classNames } from './utils';
import { IcChevronDown } from './icons';
import type { MentionFetchFn, MentionItem } from './mentions';
import {
  getAttachmentIds,
  getPendingAttachmentsCount,
  getResolvedAttachments,
  getSessionUploadedIds,
  insertFiles,
  insertStagedFiles,
  subscribeToPendingCount,
  uploadStagedFiles,
  type Attachment,
  type OnUploadError,
  type OnUploadRequest,
} from './attachments/AttachmentManager';
import {
  DEFAULT_ACCEPTED_FILE_TYPES,
  DEFAULT_MAX_FILE_SIZE_MB,
  DEFAULT_MAX_FILES_PER_BATCH,
} from './attachments/constants';
import { useDraft } from './useDraft';
import { compareRichTextSnapshots, parseWithEditorWhitespaceRules } from './diff';

const extractMentionIds = (editor: TiptapEditor): Array<string | number> => {
  const ids: Array<string | number> = [];
  const walk = (node: JSONContent) => {
    if (node.type === 'mention' && node.attrs?.id != null) ids.push(node.attrs.id);
    node.content?.forEach(walk);
  };
  walk(editor.getJSON());
  return ids;
};

// Schema-aware, not string-matched — Tiptap's own isEmpty walks the actual
// ProseMirror doc, so any depth of nested-but-blank paragraphs still
// counts as empty no matter what whitespace the HTML happens to contain.
const isEditorEmpty = (editor: TiptapEditor | null): boolean => {
  if (!editor || editor.isDestroyed) return true;
  return editor.isEmpty;
};

export interface EditorHandle {
  /** Serialized HTML, or '' when the document is empty. */
  getHTML: () => string;
  getText: () => string;
  isEmpty: () => boolean;
  focus: () => void;
  /** Clears the document and its undo/redo history. */
  clear: () => void;
  /** Escape hatch to the underlying Tiptap editor instance. */
  getInstance: () => TiptapEditor | null;

  /** Number of uploads currently queued or in flight. */
  getPendingUploadsCount: () => number;
  /** Every successfully-uploaded attachment currently in the document. */
  getAttachments: () => Attachment[];
  getAttachmentIds: () => string[];
  /** Ids uploaded this session, including ones since removed from the doc
   *  (via undo/backspace/delete) — see AttachmentManager for why this is
   *  tracked separately from getAttachmentIds(). */
  getSessionUploadedIds: () => string[];
  /** Deferred-upload mode only: uploads every currently-staged file and
   *  resolves to the final attachment ids. Call before submitting. */
  uploadStagedFiles: () => Promise<string[]>;
  triggerImageUpload: () => void;
  triggerFileUpload: () => void;
  /** For consumers with their own drop zone wider than the editor itself. */
  insertFiles: (fileList: FileList | File[]) => void;

  /** Flushes the debounced draft write immediately (e.g. right before
   *  navigating away). No-op when `draftKey` isn't set. */
  saveDraftNow: () => void;
  /** Deletes the stored draft. No-op when `draftKey` isn't set. */
  clearDraft: () => void;
  hasDraft: () => boolean;
  getDraftValue: () => string | null;
  /** Whether the live document is unchanged from the given baseline HTML
   *  — a document-model diff (marks, node types, attrs), not a string
   *  compare, so incidental re-serialization differences never register
   *  as a change. Prefer this over comparing two HTML strings directly. */
  isUnchangedFrom: (html: string) => boolean;
}

export interface EditorProps {
  /** Initial/controlled HTML content. */
  content?: string;
  /** Fires on every document change with (html, plainText, editor). */
  onChange?: (html: string, text: string, editor: TiptapEditor) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  /** Renders an error state + message below the editor. */
  error?: string;
  autoFocus?: boolean;
  onBlur?: (event: FocusEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;

  /** Hides the toolbar outright. Ignored when `collapsible` is set. */
  hideToolbar?: boolean;
  /** Per-feature toolbar switches — every key defaults to `true`. */
  toolbarItems?: Partial<ToolbarItems>;
  /** The '/' slash-command menu (headings, lists, table, code, quote). On by default. */
  enableSlashCommands?: boolean;

  /** Collapse/expand toggle. When set, this owns toolbar visibility. */
  collapsible?: boolean;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;

  /** '@' mentions — off by default. */
  enableMentions?: boolean;
  /** Async lookup, e.g. `(query) => api.searchUsers(query)`. Ignored when `mentionList` is set. */
  mentionFetchFn?: MentionFetchFn;
  /** Static list — filtered in-memory, takes priority over `mentionFetchFn`. */
  mentionList?: MentionItem[];
  /** Fires with every mention id currently in the document, on each change. */
  onMentionIds?: (ids: Array<string | number>) => void;
  /** Fires when a mention chip is clicked while editing. */
  onMentionClick?: (data: { id: string | number; label: string; event: MouseEvent }) => void;

  /** File/image uploads — off by default. */
  enableFileUpload?: boolean;
  /** Required when enableFileUpload is set: performs the actual upload. */
  onUploadRequest?: OnUploadRequest;
  /** file is null for batch-level errors (e.g. too many files at once). */
  onUploadError?: OnUploadError;
  onPendingUploadsChange?: (count: number) => void;
  maxFileSizeMB?: number;
  acceptedFileTypes?: string[];
  maxFilesPerBatch?: number;
  /** Files attached while composing are inserted inline immediately (same
   *  as always) but held in memory only, and only actually uploaded when
   *  the consumer calls the `uploadStagedFiles` ref method (i.e. at submit
   *  time). Lost on refresh/tab-close before that, same as any unsaved
   *  draft. */
  deferUploads?: boolean;

  /** Extra Tiptap extensions merged into the editor's own list — a node,
   *  mark, keyboard shortcut, or any third-party Tiptap extension. Pass
   *  a stable (e.g. module-level or memoized) array; a new array
   *  reference every render recreates the editor. If one of your
   *  extensions shares a name with a built-in one, yours wins — same
   *  last-registered-wins rule Tiptap itself uses. */
  extensions?: AnyExtension[];
  /** Renders extra content at the end of the toolbar row (e.g. your own
   *  buttons). Receives the live Tiptap editor instance. Ignored when
   *  the toolbar is hidden. */
  toolbarEnd?: (editor: TiptapEditor) => ReactNode;

  /** Enables localStorage-backed draft autosave under this key. On
   *  mount, an existing draft takes priority over `content` — this is
   *  meant for "unsent compose box" use cases, not for content that's
   *  already been saved elsewhere. */
  draftKey?: string;
  /** Fires whenever the draft's presence/value changes.
   *  `isDifferentFromContent` is a document-model diff against the
   *  current `content` prop — useful for only showing a "restore draft?"
   *  prompt when the draft is meaningfully different. */
  onDraftStatusChange?: (status: {
    hasDraft: boolean;
    draftValue: string | null;
    isDifferentFromContent: boolean;
  }) => void;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  {
    content = '',
    onChange,
    editable = true,
    placeholder,
    className = '',
    error,
    autoFocus = false,
    onBlur,
    onKeyDown,
    hideToolbar = false,
    toolbarItems: toolbarItemsProp,
    enableSlashCommands = true,
    collapsible = false,
    defaultExpanded = false,
    expanded,
    onExpandedChange,
    enableMentions = false,
    mentionFetchFn,
    mentionList,
    onMentionIds,
    onMentionClick,
    enableFileUpload = false,
    onUploadRequest,
    onUploadError,
    onPendingUploadsChange,
    maxFileSizeMB = DEFAULT_MAX_FILE_SIZE_MB,
    acceptedFileTypes = DEFAULT_ACCEPTED_FILE_TYPES,
    maxFilesPerBatch = DEFAULT_MAX_FILES_PER_BATCH,
    deferUploads = false,
    extensions: extraExtensions,
    toolbarEnd,
    draftKey,
    onDraftStatusChange,
  },
  ref
) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Layout effect, not a regular effect — showModal() has to run before
  // paint, or the dialog briefly commits to the DOM in its closed
  // (display: none) state first, flashing a blank frame.
  useLayoutEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;
    if (isFullscreen) {
      if (!dialogEl.open) dialogEl.showModal();
    } else if (dialogEl.open) {
      dialogEl.close();
    }
  }, [isFullscreen]);

  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = collapsible ? (expanded !== undefined ? expanded : internalExpanded) : true;
  const effectiveHideToolbar = collapsible ? !isExpanded : hideToolbar;
  const handleToggleExpand = useCallback(() => {
    const next = !isExpanded;
    if (expanded === undefined) setInternalExpanded(next);
    onExpandedChange?.(next);
  }, [isExpanded, expanded, onExpandedChange]);

  const toolbarItems = useMemo(() => mergeToolbarItems(toolbarItemsProp), [toolbarItemsProp]);

  const { draftValue, hasDraft, setDraftValue, saveDraftNow, clearDraft, getDraftValueSync } = useDraft(draftKey);

  // Draft wins over `content` on initial mount only — this only feeds
  // the editor's *starting* content (useEditor's `content` option isn't
  // reactive), so a later external `content` change is still picked up
  // normally by the sync effect below via `lastEmittedRef`, which is
  // deliberately seeded from `content` (not the draft) so that effect
  // stays quiet on mount instead of immediately overwriting the
  // just-loaded draft back to `content`.
  const initialContent = useMemo(
    () => (draftKey && hasDraft && draftValue ? draftValue : content),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onDraftStatusChangeRef = useRef(onDraftStatusChange);
  useEffect(() => {
    onDraftStatusChangeRef.current = onDraftStatusChange;
  }, [onDraftStatusChange]);

  useEffect(() => {
    if (!draftKey) return;
    onDraftStatusChangeRef.current?.({
      hasDraft,
      draftValue,
      isDifferentFromContent:
        hasDraft && draftValue != null
          ? !compareRichTextSnapshots(draftValue, content, {
              toolbarItems: toolbarItemsProp,
              enableMentions,
              enableFileUpload,
            })
          : false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, hasDraft, draftValue, content, enableMentions, enableFileUpload]);

  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const onKeyDownRef = useRef(onKeyDown);
  const onMentionIdsRef = useRef(onMentionIds);
  const onMentionClickRef = useRef(onMentionClick);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);
  useEffect(() => {
    onKeyDownRef.current = onKeyDown;
  }, [onKeyDown]);
  useEffect(() => {
    onMentionIdsRef.current = onMentionIds;
  }, [onMentionIds]);
  useEffect(() => {
    onMentionClickRef.current = onMentionClick;
  }, [onMentionClick]);

  const lastEmittedRef = useRef(content);
  const editorRef = useRef<TiptapEditor | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // True while a suggestion popup (mention/slash) is open — gates
  // handleKeyDown below so Enter/Escape reach the popup (select an item,
  // dismiss it) instead of the host app's own onKeyDown, e.g. a chat
  // composer's "Enter sends the message".
  const isSuggestionActiveRef = useRef(false);
  const handleSuggestionActiveChange = useCallback((active: boolean) => {
    isSuggestionActiveRef.current = active;
  }, []);

  const mentionFetchFnRef = useRef(mentionFetchFn);
  const mentionListRef = useRef(mentionList);
  const noResultsCacheRef = useRef(new Set<string>());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const onLoadingChangeRef = useRef<((loading: boolean) => void) | null>(null);
  useEffect(() => {
    mentionFetchFnRef.current = mentionFetchFn;
  }, [mentionFetchFn]);
  useEffect(() => {
    mentionListRef.current = mentionList;
  }, [mentionList]);
  useEffect(
    () => () => {
      clearTimeout(debounceTimerRef.current);
      noResultsCacheRef.current.clear();
    },
    []
  );

  const extensions = useMemo(
    () =>
      buildExtensions({
        toolbarItems,
        placeholder,
        enableSlashCommands,
        onSuggestionActiveChange: handleSuggestionActiveChange,
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
        onTriggerImageUpload: () => imageInputRef.current?.click(),
        onTriggerFileUpload: () => fileInputRef.current?.click(),
      }).concat(extraExtensions ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      toolbarItems,
      placeholder,
      enableSlashCommands,
      enableMentions,
      enableFileUpload,
      onUploadRequest,
      onUploadError,
      maxFileSizeMB,
      acceptedFileTypes,
      maxFilesPerBatch,
      extraExtensions,
    ]
  );

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable,
    autofocus: autoFocus ? 'end' : false,
    parseOptions: { preserveWhitespace: 'full' },

    onUpdate: ({ editor: e }) => {
      const html = isEditorEmpty(e) ? '' : e.getHTML();
      lastEmittedRef.current = html;
      onChangeRef.current?.(html, e.getText(), e);
      onMentionIdsRef.current?.(extractMentionIds(e));
      if (draftKey) setDraftValue(html);
    },

    onBlur: ({ event }) => onBlurRef.current?.(event as unknown as FocusEvent),

    editorProps: {
      transformPastedText: (text) => {
        if (toolbarItems[TOOLBAR_KEYS.TABLE] && text?.includes('\t') && text.includes('\n')) {
          const rows = text.trim().split('\n').map((row) => row.split('\t'));
          if (rows.length > 0 && rows[0].length > 1) {
            return `<table>${rows
              .map(
                (row) =>
                  `<tr>${row
                    .map((cell) => `<td>${cell.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`)
                    .join('')}</tr>`
              )
              .join('')}</table>`;
          }
        }
        return text;
      },
      handleKeyDown: (_view, event) => {
        if (isSuggestionActiveRef.current) return false;
        onKeyDownRef.current?.(event);
        return event.defaultPrevented;
      },
      handleClickOn: (_view, _pos, node, _nodePos, event) => {
        if (node.type.name !== 'mention' || !onMentionClickRef.current) return false;
        onMentionClickRef.current({
          id: node.attrs.id,
          label: node.attrs.label ?? node.attrs.id ?? '',
          event,
        });
        return false; // don't block normal cursor placement around the chip
      },
      handleDrop: (view, event) => {
        if (!enableFileUpload || !editable) return false;
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;

        event.preventDefault();
        const coords = { left: event.clientX, top: event.clientY };
        const dropPos = view.posAtCoords(coords)?.pos;
        const insertOpts = { at: typeof dropPos === 'number' ? dropPos : undefined };
        if (deferUploads) {
          insertStagedFiles(editorRef.current, files, insertOpts);
        } else {
          insertFiles(editorRef.current, files, insertOpts);
        }
        return true;
      },
      handlePaste: (_view, event) => {
        if (!enableFileUpload || !editable) return false;
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.length) return false;

        event.preventDefault();
        if (deferUploads) {
          insertStagedFiles(editorRef.current, files);
        } else {
          insertFiles(editorRef.current, files);
        }
        return true;
      },
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.isEditable !== editable) editor.setEditable(editable);
  }, [editable, editor]);

  // Sync an externally-changed `content` prop (initial load, form reset,
  // clearing to '' after a successful submit) without re-emitting onChange
  // or fighting the user's own in-progress edits.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (content !== lastEmittedRef.current) {
      lastEmittedRef.current = content;
      editor.commands.setContent(content || '', {
        emitUpdate: false,
        parseOptions: { preserveWhitespace: 'full' },
      });
    }
  }, [content, editor]);

  // Track pending upload count and warn on unload while uploads are in
  // flight, or while deferred-mode files are staged but not yet
  // submitted — those live only in memory and would be lost.
  useEffect(() => {
    if (!editor || !enableFileUpload) return undefined;

    const sync = () => onPendingUploadsChange?.(getPendingAttachmentsCount(editor));
    sync();
    const unsubscribe = subscribeToPendingCount(editor, sync);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasStaged = (editor.storage?.attachmentManager?.stagedFiles?.size ?? 0) > 0;
      if (getPendingAttachmentsCount(editor) > 0 || hasStaged) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [editor, enableFileUpload, onPendingUploadsChange]);

  useImperativeHandle(
    ref,
    () => ({
      getHTML: () => (editorRef.current && !editorRef.current.isDestroyed ? (isEditorEmpty(editorRef.current) ? '' : editorRef.current.getHTML()) : ''),
      getText: () => (editorRef.current && !editorRef.current.isDestroyed ? editorRef.current.getText() : ''),
      isEmpty: () => isEditorEmpty(editorRef.current),
      focus: () => editorRef.current?.chain().focus().run(),
      clear: () => {
        if (editorRef.current && !editorRef.current.isDestroyed) {
          lastEmittedRef.current = '';
          editorRef.current.commands.clearContent(false);
        }
        clearDraft();
      },
      getInstance: () => editorRef.current,
      getPendingUploadsCount: () => getPendingAttachmentsCount(editorRef.current),
      getAttachments: () => getResolvedAttachments(editorRef.current),
      getAttachmentIds: () => getAttachmentIds(editorRef.current),
      getSessionUploadedIds: () => getSessionUploadedIds(editorRef.current),
      uploadStagedFiles: () => uploadStagedFiles(editorRef.current),
      triggerImageUpload: () => imageInputRef.current?.click(),
      triggerFileUpload: () => fileInputRef.current?.click(),
      insertFiles: (fileList: FileList | File[]) =>
        deferUploads ? insertStagedFiles(editorRef.current, fileList) : insertFiles(editorRef.current, fileList),
      saveDraftNow,
      clearDraft,
      hasDraft: () => getDraftValueSync() != null,
      getDraftValue: () => getDraftValueSync(),
      isUnchangedFrom: (html: string) => {
        if (!editorRef.current || editorRef.current.isDestroyed) return true;
        try {
          const baseline = parseWithEditorWhitespaceRules(html, extensions);
          return JSON.stringify(baseline) === JSON.stringify(editorRef.current.getJSON());
        } catch {
          // Unparseable baseline — fail open to "changed" rather than
          // silently block a real save behind a broken comparison.
          return false;
        }
      },
    }),
    [deferUploads, saveDraftNow, clearDraft, getDraftValueSync, extensions]
  );

  if (!editor) return null;

  const content_ = (
    <div className="rte-outer">
      <div
        className={classNames(
          'rte-wrapper',
          error && 'rte-wrapper--error',
          isFullscreen && 'rte-wrapper--fullscreen',
          collapsible && !isExpanded && 'rte-wrapper--collapsed',
          !editable && 'rte-wrapper--readonly',
          className
        )}
      >
        {!effectiveHideToolbar && (
          <Toolbar
            editor={editor}
            toolbarItems={toolbarItems}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((p) => !p)}
            collapsible={collapsible}
            onToggleExpand={handleToggleExpand}
            enableFileUpload={enableFileUpload}
            onTriggerImageUpload={() => imageInputRef.current?.click()}
            onTriggerFileUpload={() => fileInputRef.current?.click()}
            toolbarEnd={toolbarEnd}
          />
        )}

        {collapsible && !isExpanded && (
          <button
            type="button"
            className="rte-collapse-toggle"
            title="Expand"
            aria-label="Expand editor"
            onMouseDown={(e) => {
              e.preventDefault();
              handleToggleExpand();
            }}
          >
            <IcChevronDown />
          </button>
        )}

        {enableFileUpload && (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const files = e.target.files;
                if (files) {
                  if (deferUploads) insertStagedFiles(editor, files);
                  else insertFiles(editor, files);
                }
                e.target.value = '';
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedFileTypes.join(',')}
              multiple
              hidden
              onChange={(e) => {
                const files = e.target.files;
                if (files) {
                  if (deferUploads) insertStagedFiles(editor, files);
                  else insertFiles(editor, files);
                }
                e.target.value = '';
              }}
            />
          </>
        )}

        <div className="rte-editor-area">
          <EditorContent editor={editor} className="rte-editor-content-wrapper" />
        </div>
      </div>

      {error && <div className="rte-error-text">{error}</div>}
    </div>
  );

  if (!isFullscreen) return content_;

  return (
    <dialog
      ref={dialogRef}
      className="rte-fullscreen-dialog"
      onCancel={(e) => {
        e.preventDefault();
        setIsFullscreen(false);
      }}
      onClose={() => setIsFullscreen(false)}
    >
      {content_}
    </dialog>
  );
});
