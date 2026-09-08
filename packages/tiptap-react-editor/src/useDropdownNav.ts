import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type { SuggestionKeyDownProps } from '@tiptap/suggestion';

export interface DropdownNavHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface UseDropdownNavOptions<T> {
  items: T[];
  onSelect: (item: T, index: number) => void;
  isLoading?: boolean;
  itemSelector: string;
}

/**
 * Keyboard navigation + auto-scroll for floating suggestion dropdowns
 * (slash commands, mentions). Exposes `onKeyDown` via `ref` so the
 * Suggestion plugin can relay ProseMirror keydown events into the list.
 */
export function useDropdownNav<T>(
  { items, onSelect, isLoading = false, itemSelector }: UseDropdownNavOptions<T>,
  ref: Ref<DropdownNavHandle>
) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    if (!containerRef.current) return;
    const listElements = containerRef.current.querySelectorAll(itemSelector);
    const selectedEl = listElements[selectedIndex];
    selectedEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex, itemSelector]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (isLoading) return false;
        const count = Math.max(items.length, 1);

        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % count);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % count);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const item = items[selectedIndex];
          if (item) onSelect(item, selectedIndex);
          return true;
        }
        return false;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, selectedIndex, isLoading, onSelect]
  );

  return {
    selectedIndex,
    containerRef,
    selectIndex: (index: number) => {
      const item = items[index];
      if (item) onSelect(item, index);
    },
  };
}
