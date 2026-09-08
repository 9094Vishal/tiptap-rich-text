import { ReactRenderer } from '@tiptap/react';
import { Mention } from '@tiptap/extension-mention';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { MentionList, type MentionItem } from './MentionList';
import { mountSuggestionPopup } from './suggestionRender';
import type { DropdownNavHandle } from './useDropdownNav';

export type { MentionItem };

export type MentionFetchFn = (query: string) => Promise<MentionItem[]>;

const filterMentionList = (list: MentionItem[], trimmed: string): MentionItem[] => {
  if (!trimmed) return list;
  return list.filter((item) => item.value.toLowerCase().includes(trimmed));
};

interface MentionSuggestionRefs {
  mentionFetchFnRef: { current: MentionFetchFn | undefined };
  mentionListRef: { current: MentionItem[] | undefined };
  noResultsCacheRef: { current: Set<string> };
  debounceTimerRef: { current: ReturnType<typeof setTimeout> | undefined };
  onLoadingChangeRef: { current: ((loading: boolean) => void) | null };
}

const createMentionSuggestion = (
  refs: MentionSuggestionRefs,
  onActiveChange?: (active: boolean) => void
): Omit<SuggestionOptions<MentionItem>, 'editor'> => ({
  char: '@',
  allowSpaces: true,

  items: ({ query }) =>
    new Promise((resolve) => {
      clearTimeout(refs.debounceTimerRef.current);

      // Disallow multiple consecutive spaces (max 1 space allowed, e.g. "@jane doe")
      if (/\s{2,}/.test(query)) {
        refs.onLoadingChangeRef.current?.(false);
        resolve([]);
        return;
      }

      const trimmed = query.replace(/\s+/g, ' ').trim().toLowerCase();

      // A static list takes priority over the API — no network call, no
      // debounce, no minimum length, filtered in-memory instead.
      if (refs.mentionListRef.current) {
        refs.onLoadingChangeRef.current?.(false);
        resolve(filterMentionList(refs.mentionListRef.current, trimmed));
        return;
      }

      if (!trimmed || trimmed.length < 3 || !refs.mentionFetchFnRef.current) {
        refs.onLoadingChangeRef.current?.(false);
        resolve([]);
        return;
      }
      if (refs.noResultsCacheRef.current.has(trimmed)) {
        refs.onLoadingChangeRef.current?.(false);
        resolve([]);
        return;
      }

      refs.onLoadingChangeRef.current?.(true);

      refs.debounceTimerRef.current = setTimeout(async () => {
        try {
          const results = await refs.mentionFetchFnRef.current!(trimmed);
          if (!results?.length) refs.noResultsCacheRef.current.add(trimmed);
          resolve(results || []);
        } catch {
          resolve([]);
        } finally {
          refs.onLoadingChangeRef.current?.(false);
        }
      }, 500);
    }),

  // Bespoke render (not the shared createSuggestionRender) — mentions
  // need an extra loading-state side-channel: `items()` above is async
  // and won't resolve (re-rendering the list) until the debounced fetch
  // finishes, so the "Searching…" state has to be pushed into the
  // already-mounted component directly the moment the fetch starts.
  render: () => {
    let component: ReactRenderer<DropdownNavHandle> | undefined;
    let popup: ReturnType<typeof mountSuggestionPopup> | undefined;

    return {
      onStart: (props) => {
        onActiveChange?.(true);
        component = new ReactRenderer(MentionList, {
          props: { ...props, isLoading: false },
          editor: props.editor,
        });
        refs.onLoadingChangeRef.current = (loading) => component?.updateProps({ isLoading: loading });

        if (!props.clientRect) return;
        popup = mountSuggestionPopup(props.editor, component.element as HTMLElement);
        popup.show(props.clientRect);
      },

      onUpdate: (props) => {
        component?.updateProps(props);
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
        refs.onLoadingChangeRef.current = null;
        popup?.destroy();
        component?.destroy();
        popup = undefined;
        component = undefined;
      },
    };
  },
});

export const createMentionExtension = (refs: MentionSuggestionRefs, onActiveChange?: (active: boolean) => void) =>
  Mention.configure({
    HTMLAttributes: { class: 'rte-mention-chip' },
    renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id ?? ''}`,
    suggestion: createMentionSuggestion(refs, onActiveChange),
  });
