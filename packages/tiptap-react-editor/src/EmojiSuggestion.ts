import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { EmojiList } from './EmojiList';
import { searchEmojis, type EmojiItem } from './emojiData';
import { createSuggestionRender } from './suggestionRender';

export const EmojiSuggestionPluginKey = new PluginKey('emojiSuggestion');

export interface EmojiSuggestionOptions {
  onSuggestionActiveChange: ((active: boolean) => void) | null;
}

export const EmojiSuggestion = Extension.create<EmojiSuggestionOptions>({
  name: 'emojiSuggestion',

  addOptions() {
    return { onSuggestionActiveChange: null };
  },

  addProseMirrorPlugins() {
    const { onSuggestionActiveChange } = this.options;

    return [
      Suggestion<EmojiItem>({
        editor: this.editor,
        pluginKey: EmojiSuggestionPluginKey,
        char: ':',
        allowSpaces: false,
        items: ({ query }) => searchEmojis(query, 15),
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).insertContent(`${props.emoji} `).run();
        },
        render: createSuggestionRender(EmojiList, undefined, onSuggestionActiveChange ?? undefined),
      }),
    ];
  },
});
