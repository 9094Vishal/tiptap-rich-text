import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';

const DEFAULT_URL_PREFIX = 'https://';
const URL_PROTOCOL_REGEX = /^(https?:\/\/|mailto:|tel:)/i;

export interface LinkPopupProps {
  initialUrl: string;
  isTextSelected: boolean;
  onConfirm: (url: string, textToDisplay: string) => void;
  onClose: () => void;
}

export function LinkPopup({ initialUrl, isTextSelected, onConfirm, onClose }: LinkPopupProps) {
  const [url, setUrl] = useState(initialUrl || DEFAULT_URL_PREFIX);
  const [text, setText] = useState('');
  const urlInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const needsDisplayText = !isTextSelected && !initialUrl;

  useEffect(() => {
    const target = needsDisplayText ? textInputRef.current : urlInputRef.current;
    const id = setTimeout(() => target?.focus(), 50);
    return () => clearTimeout(id);
  }, [needsDisplayText]);

  const confirm = () => {
    let trimmed = url.trim();
    if (trimmed === DEFAULT_URL_PREFIX) trimmed = '';
    if (trimmed && !URL_PROTOCOL_REGEX.test(trimmed)) trimmed = `https://${trimmed}`;
    onConfirm(trimmed, text.trim());
    onClose();
  };

  return (
    <div className="rte-link-popup">
      {needsDisplayText && (
        <input
          ref={textInputRef}
          className="rte-link-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              urlInputRef.current?.focus();
            }
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Text to display"
        />
      )}
      <div className="rte-link-row">
        <input
          ref={urlInputRef}
          className="rte-link-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirm();
            }
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Paste a link"
        />
        <button type="button" className="rte-link-apply" onMouseDown={(e) => e.preventDefault()} onClick={confirm}>
          Apply
        </button>
      </div>
    </div>
  );
}

export function applyLinkFromPopup(editor: Editor, url: string, textToDisplay: string) {
  const chain = editor.chain().focus();

  if (!url) {
    chain.extendMarkRange('link').unsetLink().run();
    return;
  }

  if (textToDisplay) {
    chain
      .extendMarkRange('link')
      .insertContent({
        type: 'text',
        text: textToDisplay,
        marks: [{ type: 'link', attrs: { href: url } }],
      })
      .run();
    return;
  }

  if (editor.state.selection.empty) {
    chain
      .insertContent({
        type: 'text',
        text: url,
        marks: [{ type: 'link', attrs: { href: url } }],
      })
      .run();
    return;
  }

  chain.extendMarkRange('link').setLink({ href: url }).run();
}
