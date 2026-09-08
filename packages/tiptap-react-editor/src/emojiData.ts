import emojiMartData from '@emoji-mart/data';

export interface EmojiItem {
  shortcode: string;
  emoji: string;
  title: string;
  keywords: string[];
}

interface EmojiMartSkin {
  native?: string;
}

interface EmojiMartEntry {
  name?: string;
  keywords?: string[];
  skins?: EmojiMartSkin[];
}

interface EmojiMartData {
  emojis?: Record<string, EmojiMartEntry>;
}

let allEmojisCache: EmojiItem[] | null = null;

const getAllEmojis = (): EmojiItem[] => {
  if (allEmojisCache) return allEmojisCache;

  const list: EmojiItem[] = [];
  const emojisObj = (emojiMartData as EmojiMartData)?.emojis ?? {};

  for (const id in emojisObj) {
    const item = emojisObj[id];
    const nativeEmoji = item?.skins?.[0]?.native;
    if (nativeEmoji) {
      list.push({ shortcode: id, emoji: nativeEmoji, title: item.name || id, keywords: item.keywords || [] });
    }
  }

  allEmojisCache = list;
  return list;
};

/** Searches by shortcode prefix first, then substring, then keywords. */
export const searchEmojis = (query = '', limit = 15): EmojiItem[] => {
  const all = getAllEmojis();
  if (!query) return all.slice(0, limit);

  const lower = query.toLowerCase().trim();
  const exactStarts: EmojiItem[] = [];
  const contains: EmojiItem[] = [];
  const keywordMatches: EmojiItem[] = [];

  for (const item of all) {
    const code = item.shortcode.toLowerCase();
    const title = item.title.toLowerCase();

    if (code.startsWith(lower)) {
      exactStarts.push(item);
    } else if (code.includes(lower) || title.includes(lower)) {
      contains.push(item);
    } else if (item.keywords.some((k) => k.toLowerCase().includes(lower))) {
      keywordMatches.push(item);
    }
  }

  return [...exactStarts, ...contains, ...keywordMatches].slice(0, limit);
};
