import { useEffect, useMemo, useRef } from 'react';
import { classNames } from './utils';

const isContentEmpty = (html: string): boolean => {
  if (!html) return true;
  // Strip tags to check for real text, but an atom node (image, file
  // attachment, mention) with no text content should still count as
  // non-empty — a stray self-closing/void tag left in the markup is
  // signal enough without needing to special-case every node type.
  const stripped = html.replace(/<[^>]*>/g, '').trim();
  if (stripped) return false;
  return !/<(img|video|audio|table)[\s/>]/i.test(html) && !/data-type="(mention|file-attachment)"/.test(html);
};

export interface MentionClickData {
  id: string | null;
  label: string | null;
  attributes: Record<string, string | undefined>;
  element: HTMLElement;
  event: MouseEvent;
}

export interface ImageClickData {
  url: string;
  alt: string;
  element: HTMLImageElement;
  event: MouseEvent;
}

export interface FileClickData {
  id: string | null;
  url: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  element: HTMLElement;
  event: MouseEvent;
}

export interface RichTextPreviewProps {
  /** HTML string from Editor's onChange callback. */
  content: string;
  className?: string;
  /** Text shown when content is empty. Omit to render nothing. */
  emptyText?: string;
  /** Fires when a mention chip is clicked. Omit to leave chips inert —
   *  there's no built-in default navigation, since only the host app
   *  knows what a mention id resolves to. */
  onMentionClick?: (data: MentionClickData) => void;
  /** Fires when an attachment image is clicked. Omit to open it in a new
   *  tab (the default); pass this to open an in-app lightbox instead. */
  onImageClick?: (data: ImageClickData) => void;
  /** Fires when a non-image attachment chip is clicked. Omit to keep the
   *  default behavior (the chip's own link opens/downloads normally). */
  onFileClick?: (data: FileClickData) => void;
}

export function RichTextPreview({
  content = '',
  className = '',
  emptyText = '',
  onMentionClick,
  onImageClick,
  onFileClick,
}: RichTextPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const empty = useMemo(() => isContentEmpty(content), [content]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll('a').forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }, [content]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      const img = target.closest('img');
      if (img && container.contains(img)) {
        if (onImageClick) {
          onImageClick({ url: img.src, alt: img.alt, element: img, event });
        } else {
          window.open(img.src, '_blank', 'noopener,noreferrer');
        }
        return;
      }

      const mentionEl = target.closest<HTMLElement>('[data-type="mention"]');
      if (mentionEl && container.contains(mentionEl) && onMentionClick) {
        const dataset = mentionEl.dataset;
        onMentionClick({
          id: dataset.id ?? null,
          label: dataset.label ?? mentionEl.textContent,
          attributes: { ...dataset },
          element: mentionEl,
          event,
        });
        return;
      }

      const fileChip = target.closest<HTMLElement>('[data-type="file-attachment"]');
      if (fileChip && container.contains(fileChip) && onFileClick) {
        event.preventDefault();
        const link = fileChip.querySelector('a[href]');
        const fileSize = fileChip.getAttribute('data-file-size');
        onFileClick({
          id: fileChip.getAttribute('data-id'),
          url: link?.getAttribute('href') ?? null,
          fileName: fileChip.getAttribute('data-file-name'),
          fileSize: fileSize ? Number(fileSize) : null,
          mimeType: fileChip.getAttribute('data-mime-type'),
          element: fileChip,
          event,
        });
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [content, onMentionClick, onImageClick, onFileClick]);

  if (empty) {
    return emptyText ? <span className="rte-preview-empty">{emptyText}</span> : null;
  }

  return (
    <div className="rte-outer">
      <div
        ref={containerRef}
        className={classNames('ProseMirror', 'rte-preview', className)}
        // Content comes from this package's own Editor — structure is controlled.
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
