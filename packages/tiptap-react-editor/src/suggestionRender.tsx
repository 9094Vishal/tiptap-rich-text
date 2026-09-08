import { ReactRenderer } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import type { DropdownNavHandle } from './useDropdownNav';

/**
 * Creates a fixed-position popup element kept in sync with a Suggestion
 * plugin's `clientRect` — no tippy.js dependency. Appends inside an open
 * native <dialog> (fullscreen mode) rather than always to document.body,
 * since showModal() promotes the dialog to the top layer and makes
 * everything outside it inert.
 */
export function mountSuggestionPopup(editor: Editor, child: HTMLElement) {
  const el = document.createElement('div');
  el.className = 'rte-suggestion-popup';
  el.style.visibility = 'hidden';
  el.appendChild(child);

  const target = editor.view.dom.closest('dialog[open]') ?? document.body;
  target.appendChild(el);

  const reposition = (clientRect: (() => DOMRect | null) | null | undefined) => {
    if (!clientRect) return;
    const rect = clientRect();
    if (!rect) return;
    const popRect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = rect.bottom + 6;
    let left = rect.left;
    if (left + popRect.width > vw - 8) left = vw - popRect.width - 8;
    if (left < 8) left = 8;
    if (top + popRect.height > vh - 8) top = rect.top - popRect.height - 6;

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  };

  return {
    el,
    show: (clientRect: (() => DOMRect | null) | null | undefined) => {
      requestAnimationFrame(() => {
        reposition(clientRect);
        el.style.visibility = 'visible';
      });
    },
    reposition,
    destroy: () => el.remove(),
  };
}

/**
 * Builds a caret-anchored popup renderer for a Tiptap Suggestion plugin.
 * Covers the common case (a list component with no extra state to push
 * in from outside); mentions.ts wires its own render() on top of
 * `mountSuggestionPopup` instead, since it needs an extra loading-state
 * side-channel this generic version doesn't support.
 *
 * `onActiveChange`, when given, fires (true) while the popup is open and
 * (false) once it closes — the editor uses this to know an Enter/Escape
 * keypress belongs to the popup (selecting an item, dismissing it) and
 * must not be swallowed by the host app's own onKeyDown first.
 */
export function createSuggestionRender<TItem, TProps extends object = SuggestionProps<TItem>>(
  ListComponent: React.ComponentType<TProps>,
  mapProps?: (props: SuggestionProps<TItem>) => TProps,
  onActiveChange?: (active: boolean) => void
): SuggestionOptions<TItem>['render'] {
  return () => {
    let component: ReactRenderer<DropdownNavHandle> | undefined;
    let popup: ReturnType<typeof mountSuggestionPopup> | undefined;

    return {
      onStart: (props) => {
        onActiveChange?.(true);
        component = new ReactRenderer(ListComponent, {
          props: (mapProps ? mapProps(props) : props) as TProps,
          editor: props.editor,
        });

        if (!props.clientRect) return;
        popup = mountSuggestionPopup(props.editor, component.element as HTMLElement);
        popup.show(props.clientRect);
      },

      onUpdate: (props) => {
        component?.updateProps((mapProps ? mapProps(props) : props) as TProps);
        popup?.reposition(props.clientRect);
      },

      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          popup?.destroy();
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit: () => {
        onActiveChange?.(false);
        popup?.destroy();
        component?.destroy();
        popup = undefined;
        component = undefined;
      },
    };
  };
}
