import { forwardRef, useRef, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import Picker from '@emoji-mart/react';
import emojiData from '@emoji-mart/data';
import { Popover } from './Popover';
import { LinkPopup, applyLinkFromPopup } from './LinkPopup';
import { TOOLBAR_KEYS, type ToolbarItems } from './toolbarConfig';
import { classNames } from './utils';
import { useVoiceDictation, type VoiceError } from './useVoiceDictation';
import {
  IcAlignCenter,
  IcAlignLeft,
  IcAlignRight,
  IcAttachment,
  IcBold,
  IcChevronDown,
  IcCode,
  IcColor,
  IcDivider,
  IcEmoji,
  IcExitFullscreen,
  IcFullscreen,
  IcHighlight,
  IcImage,
  IcIndentDecrease,
  IcIndentIncrease,
  IcItalic,
  IcLink,
  IcMic,
  IcOL,
  IcQuote,
  IcStrike,
  IcTable,
  IcUL,
  IcUnderline,
} from './icons';

const TEXT_COLORS = [
  '#000000', '#374151', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#fca5a5', '#fdba74',
  '#fde047', '#86efac', '#93c5fd', '#c4b5fd',
];
const HIGHLIGHT_COLORS = [
  '#fef08a', '#bbf7d0', '#bfdbfe', '#ddd6fe', '#fecaca',
  '#fed7aa', '#fbcfe8', '#e5e7eb', '#ffffff', 'transparent',
];

interface BtnProps {
  onClick?: () => void;
  isActive?: boolean;
  title: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { onClick, isActive, title, children, disabled = false, className = '' },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      className={classNames('rte-toolbar-btn', isActive && 'is-active', className)}
      title={title}
      disabled={disabled}
      aria-label={title}
      aria-pressed={isActive}
    >
      {children}
    </button>
  );
});

const Divider = () => <span className="rte-toolbar-divider" />;

function TableGridPicker({ onInsert, onClose }: { onInsert: (rows: number, cols: number) => void; onClose: () => void }) {
  const [hover, setHover] = useState({ row: 0, col: 0 });
  const GRID = 8;

  return (
    <div className="rte-table-grid-popup" onMouseLeave={() => setHover({ row: 0, col: 0 })}>
      <div className="rte-table-grid-label">
        {hover.row > 0 ? `${hover.row} × ${hover.col}` : 'Insert table'}
      </div>
      <div className="rte-table-grid">
        {Array.from({ length: GRID }, (_, r) => (
          <div key={r} className="rte-table-grid-row">
            {Array.from({ length: GRID }, (_, c) => (
              <div
                key={c}
                className={classNames(
                  'rte-table-grid-cell',
                  r < hover.row && c < hover.col && 'is-highlighted'
                )}
                onMouseEnter={() => setHover({ row: r + 1, col: c + 1 })}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onInsert(r + 1, c + 1);
                  onClose();
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TableActions({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const run = (cmd: () => void) => {
    cmd();
    onClose();
  };
  const groups: Array<Array<{ label: string; action: () => void; danger?: boolean }>> = [
    [
      { label: '↑ Insert row above', action: () => editor.chain().focus().addRowBefore().run() },
      { label: '↓ Insert row below', action: () => editor.chain().focus().addRowAfter().run() },
      { label: '← Insert col left', action: () => editor.chain().focus().addColumnBefore().run() },
      { label: '→ Insert col right', action: () => editor.chain().focus().addColumnAfter().run() },
    ],
    [
      { label: '⊞ Merge cells', action: () => editor.chain().focus().mergeCells().run() },
      { label: '⊟ Split cell', action: () => editor.chain().focus().splitCell().run() },
      { label: '▔ Toggle header row', action: () => editor.chain().focus().toggleHeaderRow().run() },
      { label: '▕ Toggle header col', action: () => editor.chain().focus().toggleHeaderColumn().run() },
    ],
    [
      { label: '✕ Delete row', action: () => editor.chain().focus().deleteRow().run(), danger: true },
      { label: '✕ Delete column', action: () => editor.chain().focus().deleteColumn().run(), danger: true },
    ],
    [{ label: '🗑 Delete table', action: () => editor.chain().focus().deleteTable().run(), danger: true }],
  ];

  return (
    <div className="rte-table-action-popup">
      {groups.map((group, i) => (
        <div key={i}>
          {group.map(({ label, action, danger }) => (
            <button
              key={label}
              type="button"
              className={classNames('rte-table-action-btn', danger && 'rte-table-action-btn--danger')}
              onMouseDown={(e) => {
                e.preventDefault();
                run(action);
              }}
            >
              {label}
            </button>
          ))}
          {i < groups.length - 1 && <div className="rte-table-action-divider" />}
        </div>
      ))}
    </div>
  );
}

function ColorPicker({
  colors,
  onSelect,
  onClose,
  customColor,
  onCustom,
}: {
  colors: string[];
  onSelect: (color: string) => void;
  onClose: () => void;
  customColor?: string;
  onCustom?: (color: string) => void;
}) {
  return (
    <div className="rte-color-popup">
      <div className="rte-color-grid">
        {colors.map((color) => (
          <div
            key={color}
            className="rte-color-swatch"
            style={{
              background:
                color === 'transparent'
                  ? 'linear-gradient(to bottom right, white 45%, red 45%, red 55%, white 55%)'
                  : color,
            }}
            title={color}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(color);
              onClose();
            }}
          />
        ))}
      </div>
      {onCustom && (
        <div className="rte-color-custom-row">
          <span className="rte-color-custom-label">Custom:</span>
          <input
            type="color"
            className="rte-color-custom-input"
            defaultValue={customColor || '#000000'}
            onChange={(e) => onCustom(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

const HEADING_OPTIONS = [
  { value: 'p', label: 'Normal text', style: { fontSize: 13, fontWeight: 400 } },
  { value: 'h1', label: 'Heading 1', style: { fontSize: 20, fontWeight: 700 } },
  { value: 'h2', label: 'Heading 2', style: { fontSize: 17, fontWeight: 700 } },
  { value: 'h3', label: 'Heading 3', style: { fontSize: 15, fontWeight: 600 } },
] as const;

function HeadingDropdown({
  editor,
  isOpen,
  onToggle,
  onClose,
}: {
  editor: Editor;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeValue = editor.isActive('heading', { level: 1 })
    ? 'h1'
    : editor.isActive('heading', { level: 2 })
      ? 'h2'
      : editor.isActive('heading', { level: 3 })
        ? 'h3'
        : 'p';

  const activeLabel = HEADING_OPTIONS.find((o) => o.value === activeValue)?.label;

  const applyHeading = (value: (typeof HEADING_OPTIONS)[number]['value']) => {
    if (value === 'p') {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = { h1: 1, h2: 2, h3: 3 }[value] as 1 | 2 | 3;
      editor.chain().focus().toggleHeading({ level }).run();
    }
    onClose();
  };

  return (
    <div className="rte-popup-anchor">
      <button
        ref={triggerRef}
        type="button"
        className="rte-heading-trigger"
        onMouseDown={(e) => {
          e.preventDefault();
          onToggle();
        }}
        title="Text style"
      >
        <span>{activeLabel}</span>
        <IcChevronDown />
      </button>
      <Popover isOpen={isOpen} onClose={onClose} triggerRef={triggerRef}>
        <div className="rte-heading-popup">
          {HEADING_OPTIONS.map(({ value, label, style }) => (
            <button
              key={value}
              type="button"
              className={classNames('rte-heading-option', activeValue === value && 'is-active')}
              style={style}
              onMouseDown={(e) => {
                e.preventDefault();
                applyHeading(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
}

const VOICE_ERROR_TITLES: Record<VoiceError['kind'], string> = {
  unsupported: "Dictation isn't supported here",
  denied: 'Microphone access denied',
  blocked: 'Speech recognition blocked',
  other: 'Voice dictation error',
};

function VoiceDictationButton({ editor }: { editor: Editor }) {
  const { isListening, error, clearError, browserInfo, toggleListening } = useVoiceDictation(editor);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="rte-popup-anchor">
      <Btn
        ref={btnRef}
        onClick={toggleListening}
        isActive={isListening}
        title={isListening ? 'Stop listening (Voice Dictation)' : 'Start Voice Dictation (Speech to text)'}
        className={isListening ? 'rte-mic-btn--listening' : ''}
      >
        <IcMic />
      </Btn>
      <Popover isOpen={Boolean(error)} onClose={clearError} triggerRef={btnRef}>
        {error && (
          <div className="rte-voice-error">
            <div className="rte-voice-error-title">{VOICE_ERROR_TITLES[error.kind]}</div>
            <p className="rte-voice-error-text">{error.message}</p>
            {error.kind === 'blocked' && browserInfo.isBrave && (
              <p className="rte-voice-error-text">
                Brave disables the Web Speech API entirely for privacy — use your OS's built-in dictation, or switch
                to Chrome, Edge, or Safari.
              </p>
            )}
            {error.kind === 'unsupported' && (
              <p className="rte-voice-error-text">
                Try your OS's built-in dictation, or switch to Chrome, Edge, or Safari.
              </p>
            )}
            {error.kind === 'denied' && (
              <p className="rte-voice-error-text">
                Allow microphone access for this site in your browser's address-bar settings, then try again.
              </p>
            )}
            <button type="button" className="rte-voice-error-dismiss" onMouseDown={(e) => e.preventDefault()} onClick={clearError}>
              Dismiss
            </button>
          </div>
        )}
      </Popover>
    </div>
  );
}

export interface ToolbarProps {
  editor: Editor;
  toolbarItems: ToolbarItems;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  collapsible: boolean;
  onToggleExpand: () => void;
  enableFileUpload: boolean;
  onTriggerImageUpload: () => void;
  onTriggerFileUpload: () => void;
  toolbarEnd?: (editor: Editor) => ReactNode;
}

export function Toolbar({
  editor,
  toolbarItems,
  isFullscreen,
  onToggleFullscreen,
  collapsible,
  onToggleExpand,
  enableFileUpload,
  onTriggerImageUpload,
  onTriggerFileUpload,
  toolbarEnd,
}: ToolbarProps) {
  const [openPopup, setOpenPopup] = useState<string | null>(null);
  const toggle = (name: string) => setOpenPopup((p) => (p === name ? null : name));
  const close = () => setOpenPopup(null);

  const textColorBtnRef = useRef<HTMLButtonElement>(null);
  const highlightBtnRef = useRef<HTMLButtonElement>(null);
  const linkBtnRef = useRef<HTMLButtonElement>(null);
  const tableBtnRef = useRef<HTMLButtonElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);

  const inTable = editor.isActive('table');

  const marks = [
    { key: TOOLBAR_KEYS.BOLD, action: 'toggleBold', icon: <IcBold />, title: 'Bold (Ctrl+B)', active: 'bold' },
    { key: TOOLBAR_KEYS.ITALIC, action: 'toggleItalic', icon: <IcItalic />, title: 'Italic (Ctrl+I)', active: 'italic' },
    { key: TOOLBAR_KEYS.UNDERLINE, action: 'toggleUnderline', icon: <IcUnderline />, title: 'Underline (Ctrl+U)', active: 'underline' },
    { key: TOOLBAR_KEYS.STRIKE, action: 'toggleStrike', icon: <IcStrike />, title: 'Strikethrough', active: 'strike' },
  ].filter(({ key }) => toolbarItems[key]);

  return (
    <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
      {toolbarItems[TOOLBAR_KEYS.HEADING] && (
        <>
          <HeadingDropdown editor={editor} isOpen={openPopup === 'heading'} onToggle={() => toggle('heading')} onClose={close} />
          <Divider />
        </>
      )}

      {marks.map(({ action, icon, title, active }) => (
        <Btn
          key={action}
          onClick={() => (editor.chain().focus() as unknown as Record<string, () => { run: () => void }>)[action]().run()}
          isActive={editor.isActive(active)}
          title={title}
        >
          {icon}
        </Btn>
      ))}

      {toolbarItems[TOOLBAR_KEYS.CLEAR_FORMATTING] && (
        <Btn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear formatting">
          <span style={{ fontSize: 12, fontWeight: 700 }}>Tx</span>
        </Btn>
      )}

      {(toolbarItems[TOOLBAR_KEYS.TEXT_COLOR] || toolbarItems[TOOLBAR_KEYS.HIGHLIGHT]) && <Divider />}

      {toolbarItems[TOOLBAR_KEYS.TEXT_COLOR] && (
        <div className="rte-popup-anchor">
          <Btn ref={textColorBtnRef} onClick={() => toggle('textColor')} title="Text color" isActive={openPopup === 'textColor'}>
            <span className="rte-swatch-btn">
              <IcColor />
              <span className="rte-swatch-bar" style={{ background: editor.getAttributes('textStyle')?.color || '#000' }} />
            </span>
          </Btn>
          <Popover isOpen={openPopup === 'textColor'} onClose={close} triggerRef={textColorBtnRef}>
            <ColorPicker
              colors={TEXT_COLORS}
              onSelect={(c) => editor.chain().focus().setColor(c).run()}
              onClose={close}
              customColor={editor.getAttributes('textStyle')?.color}
              onCustom={(c) => editor.chain().focus().setColor(c).run()}
            />
          </Popover>
        </div>
      )}

      {toolbarItems[TOOLBAR_KEYS.HIGHLIGHT] && (
        <div className="rte-popup-anchor">
          <Btn
            ref={highlightBtnRef}
            onClick={() => toggle('highlight')}
            title="Highlight color"
            isActive={openPopup === 'highlight' || editor.isActive('highlight')}
          >
            <span className="rte-swatch-btn">
              <IcHighlight />
              <span className="rte-swatch-bar" style={{ background: editor.getAttributes('highlight')?.color || '#fef08a' }} />
            </span>
          </Btn>
          <Popover isOpen={openPopup === 'highlight'} onClose={close} triggerRef={highlightBtnRef}>
            <ColorPicker
              colors={HIGHLIGHT_COLORS}
              onSelect={(c) =>
                c === 'transparent'
                  ? editor.chain().focus().unsetHighlight().run()
                  : editor.chain().focus().setHighlight({ color: c }).run()
              }
              onClose={close}
            />
          </Popover>
        </div>
      )}

      {toolbarItems[TOOLBAR_KEYS.TEXT_ALIGN] && (
        <>
          <Divider />
          {(
            [
              ['left', <IcAlignLeft key="l" />, 'Align left'],
              ['center', <IcAlignCenter key="c" />, 'Align center'],
              ['right', <IcAlignRight key="r" />, 'Align right'],
            ] as const
          ).map(([align, icon, title]) => (
            <Btn
              key={align}
              onClick={() => editor.chain().focus().setTextAlign(align).run()}
              isActive={editor.isActive({ textAlign: align })}
              title={title}
            >
              {icon}
            </Btn>
          ))}
        </>
      )}

      {toolbarItems[TOOLBAR_KEYS.LISTS] && (
        <>
          <Divider />
          <Btn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Ordered list"
          >
            <IcOL />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bullet list"
          >
            <IcUL />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().liftListItem('listItem').run()}
            disabled={!editor.isActive('listItem')}
            title="Decrease indent"
          >
            <IcIndentDecrease />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
            disabled={!editor.isActive('listItem')}
            title="Increase indent"
          >
            <IcIndentIncrease />
          </Btn>
        </>
      )}

      {(toolbarItems[TOOLBAR_KEYS.LINK] || toolbarItems[TOOLBAR_KEYS.TABLE]) && <Divider />}

      {toolbarItems[TOOLBAR_KEYS.LINK] && (
        <div className="rte-popup-anchor">
          <Btn ref={linkBtnRef} onClick={() => toggle('link')} isActive={editor.isActive('link') || openPopup === 'link'} title="Insert link">
            <IcLink />
          </Btn>
          <Popover isOpen={openPopup === 'link'} onClose={close} triggerRef={linkBtnRef}>
            <LinkPopup
              initialUrl={editor.getAttributes('link')?.href || ''}
              isTextSelected={!editor.state.selection.empty}
              onConfirm={(url, textToDisplay) => applyLinkFromPopup(editor, url, textToDisplay)}
              onClose={close}
            />
          </Popover>
        </div>
      )}

      {toolbarItems[TOOLBAR_KEYS.TABLE] && (
        <div className="rte-popup-anchor">
          <Btn ref={tableBtnRef} onClick={() => toggle('table')} isActive={inTable || openPopup === 'table'} title={inTable ? 'Table options' : 'Insert table'}>
            <IcTable />
          </Btn>
          <Popover isOpen={openPopup === 'table'} onClose={close} triggerRef={tableBtnRef}>
            {inTable ? (
              <TableActions editor={editor} onClose={close} />
            ) : (
              <TableGridPicker
                onInsert={(rows, cols) => editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()}
                onClose={close}
              />
            )}
          </Popover>
        </div>
      )}

      {toolbarItems[TOOLBAR_KEYS.EMOJI] && (
        <div className="rte-popup-anchor">
          <Btn ref={emojiBtnRef} onClick={() => toggle('emoji')} isActive={openPopup === 'emoji'} title="Emoji">
            <IcEmoji />
          </Btn>
          <Popover isOpen={openPopup === 'emoji'} onClose={close} triggerRef={emojiBtnRef}>
            <div className="rte-emoji-picker-wrapper">
              <Picker
                data={emojiData}
                onEmojiSelect={(emoji: { native: string }) => {
                  editor.chain().focus().insertContent(emoji.native).run();
                }}
                theme="light"
                previewPosition="none"
                skinTonePosition="none"
                maxFrequentRows={1}
                perLine={8}
                emojiSize={20}
              />
            </div>
          </Popover>
        </div>
      )}

      {toolbarItems[TOOLBAR_KEYS.VOICE_DICTATION] && <VoiceDictationButton editor={editor} />}

      {(toolbarItems[TOOLBAR_KEYS.CODE_BLOCK] || toolbarItems[TOOLBAR_KEYS.BLOCKQUOTE] || toolbarItems[TOOLBAR_KEYS.HORIZONTAL_RULE]) && (
        <Divider />
      )}

      {toolbarItems[TOOLBAR_KEYS.CODE_BLOCK] && (
        <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Code block">
          <IcCode />
        </Btn>
      )}
      {toolbarItems[TOOLBAR_KEYS.BLOCKQUOTE] && (
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Blockquote">
          <IcQuote />
        </Btn>
      )}
      {toolbarItems[TOOLBAR_KEYS.HORIZONTAL_RULE] && (
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Insert divider">
          <IcDivider />
        </Btn>
      )}

      {enableFileUpload && (
        <>
          <Divider />
          <Btn onClick={onTriggerImageUpload} title="Insert image">
            <IcImage />
          </Btn>
          <Btn onClick={onTriggerFileUpload} title="Attach file">
            <IcAttachment />
          </Btn>
        </>
      )}

      {toolbarItems[TOOLBAR_KEYS.FULLSCREEN] && (
        <Btn onClick={onToggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {isFullscreen ? <IcExitFullscreen /> : <IcFullscreen />}
        </Btn>
      )}

      {collapsible && (
        <Btn onClick={onToggleExpand} title="Collapse">
          <IcChevronDown />
        </Btn>
      )}

      {toolbarEnd && (
        <>
          <Divider />
          {toolbarEnd(editor)}
        </>
      )}
    </div>
  );
}
