import { forwardRef } from 'react';
import { useDropdownNav, type DropdownNavHandle } from './useDropdownNav';
import { classNames } from './utils';

export interface MentionItem {
  id: string | number;
  value: string;
  avatar?: string;
}

export interface MentionListProps {
  items: MentionItem[];
  command: (item: { id: string | number; label: string }) => void;
  isLoading?: boolean;
}

const initialsOf = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

function MentionAvatar({ item }: { item: MentionItem }) {
  if (item.avatar) {
    return <img className="rte-mention-avatar" src={item.avatar} alt="" />;
  }
  return <span className="rte-mention-avatar rte-mention-avatar--initials">{initialsOf(item.value)}</span>;
}

export const MentionList = forwardRef<DropdownNavHandle, MentionListProps>(function MentionList(
  { items = [], command, isLoading = false },
  ref
) {
  const { selectedIndex, containerRef, selectIndex } = useDropdownNav(
    {
      items,
      isLoading,
      onSelect: (item) => command({ id: item.id, label: item.value }),
      itemSelector: '.rte-mention-item',
    },
    ref
  );

  if (isLoading) {
    return (
      <div className="rte-mention-dropdown">
        <div className="rte-mention-loading">
          <span className="rte-mention-spinner" />
          <span>Searching…</span>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rte-mention-dropdown">
        <div className="rte-mention-item rte-mention-item--empty">No results found</div>
      </div>
    );
  }

  return (
    <div className="rte-mention-dropdown" ref={containerRef}>
      {items.map((item, index) => (
        <button
          key={`${item.id}-${index}`}
          type="button"
          className={classNames('rte-mention-item', index === selectedIndex && 'rte-mention-item--selected')}
          onMouseDown={(e) => {
            e.preventDefault();
            selectIndex(index);
          }}
        >
          <MentionAvatar item={item} />
          <span className="rte-mention-value">{item.value}</span>
        </button>
      ))}
    </div>
  );
});
