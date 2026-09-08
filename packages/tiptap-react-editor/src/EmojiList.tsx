import { forwardRef } from 'react';
import { useDropdownNav, type DropdownNavHandle } from './useDropdownNav';
import { classNames } from './utils';
import type { EmojiItem } from './emojiData';

export interface EmojiListProps {
  items: EmojiItem[];
  command: (item: EmojiItem) => void;
}

export const EmojiList = forwardRef<DropdownNavHandle, EmojiListProps>(function EmojiList(
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
        <div className="rte-slash-item rte-slash-item--empty">No matching emojis</div>
      </div>
    );
  }

  return (
    <div className="rte-slash-dropdown" ref={containerRef}>
      {items.map((item, index) => (
        <button
          key={item.shortcode}
          type="button"
          className={classNames('rte-slash-item', index === selectedIndex && 'rte-slash-item--selected')}
          onMouseDown={(e) => {
            e.preventDefault();
            selectIndex(index);
          }}
        >
          <span className="rte-emoji-item-glyph">{item.emoji}</span>
          <div className="rte-slash-text">
            <div className="rte-slash-title">:{item.shortcode}:</div>
            <div className="rte-slash-description">{item.title}</div>
          </div>
        </button>
      ))}
    </div>
  );
});
