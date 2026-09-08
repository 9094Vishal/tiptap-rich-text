import { forwardRef } from 'react';
import type { Editor, Range } from '@tiptap/core';
import { useDropdownNav, type DropdownNavHandle } from './useDropdownNav';
import { classNames } from './utils';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  command: (args: { editor: Editor; range: Range }) => void;
}

export interface SlashListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export const SlashList = forwardRef<DropdownNavHandle, SlashListProps>(function SlashList(
  { items = [], command },
  ref
) {
  const { selectedIndex, containerRef, selectIndex } = useDropdownNav(
    { items, onSelect: (item) => command(item), itemSelector: '.rte-slash-item' },
    ref
  );

  if (!items.length) {
    return (
      <div className="rte-slash-dropdown">
        <div className="rte-slash-item rte-slash-item--empty">No matching commands</div>
      </div>
    );
  }

  return (
    <div className="rte-slash-dropdown" ref={containerRef}>
      <div className="rte-slash-header">BASIC BLOCKS</div>
      {items.map((item, index) => (
        <button
          key={`${item.title}-${index}`}
          type="button"
          className={classNames('rte-slash-item', index === selectedIndex && 'rte-slash-item--selected')}
          onMouseDown={(e) => {
            e.preventDefault();
            selectIndex(index);
          }}
        >
          <span className="rte-slash-icon">{item.icon}</span>
          <div className="rte-slash-text">
            <div className="rte-slash-title">{item.title}</div>
            <div className="rte-slash-description">{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
});
