import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

export interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * Self-contained popover portal for toolbar popups (color pickers, the
 * link input, the table grid, etc). Renders below the trigger element,
 * clamped to the viewport, and flips above it when there isn't room below.
 *
 * Portals to document.body by default, but when the trigger lives inside
 * an open native <dialog> (fullscreen mode) it portals into that dialog
 * instead — showModal() promotes the dialog to the browser's top layer,
 * which makes everything outside it inert, so a body portal would render
 * invisible and unclickable behind it.
 */
export function Popover({ isOpen, onClose, triggerRef, children }: PopoverProps) {
  const [style, setStyle] = useState<React.CSSProperties>({
    visibility: 'hidden',
    position: 'fixed',
    zIndex: 9999,
  });
  const portalRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    if (!triggerRef.current || !portalRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const portal = portalRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = trigger.bottom + 4;
    let left = trigger.left;

    if (left + portal.width > vw - 8) left = vw - portal.width - 8;
    if (left < 8) left = 8;
    if (top + portal.height > vh - 8) top = trigger.top - portal.height - 4;

    setStyle({ position: 'fixed', top, left, zIndex: 9999, visibility: 'visible' });
  }, [triggerRef]);

  useEffect(() => {
    if (!isOpen) return;

    setStyle({ position: 'fixed', top: -9999, left: -9999, zIndex: 9999, visibility: 'hidden' });

    const rafId = requestAnimationFrame(reposition);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, reposition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const trigger = triggerRef.current;
      const clickedTrigger = trigger?.contains(e.target as Node) ?? false;
      if (!portalRef.current?.contains(e.target as Node) && !clickedTrigger) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, onClose, triggerRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  const portalTarget = triggerRef.current?.closest('dialog[open]') ?? document.body;

  return createPortal(
    <div ref={portalRef} style={style} onKeyDown={handleKeyDown}>
      {children}
    </div>,
    portalTarget
  );
}
