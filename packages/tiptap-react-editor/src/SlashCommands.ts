import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { SlashList, type SlashCommandItem } from './SlashList';
import { createSuggestionRender } from './suggestionRender';
import { TOOLBAR_KEYS, type ToolbarItems } from './toolbarConfig';

export const SlashCommandsPluginKey = new PluginKey('slashCommands');

const COMMAND_ITEMS: Array<SlashCommandItem & { toolbarKey?: keyof ToolbarItems }> = [
  {
    title: 'Heading 1',
    description: 'Big section heading',
    icon: 'H1',
    toolbarKey: TOOLBAR_KEYS.HEADING,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    toolbarKey: TOOLBAR_KEYS.HEADING,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    toolbarKey: TOOLBAR_KEYS.HEADING,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bulleted list',
    icon: '•',
    toolbarKey: TOOLBAR_KEYS.LISTS,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Create a numbered list',
    icon: '1.',
    toolbarKey: TOOLBAR_KEYS.LISTS,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'Table',
    description: 'Insert a 3x3 grid table',
    icon: '田',
    toolbarKey: TOOLBAR_KEYS.TABLE,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: 'Code Block',
    description: 'Code snippet box',
    icon: '</>',
    toolbarKey: TOOLBAR_KEYS.CODE_BLOCK,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Quote',
    description: 'Blockquote formatting',
    icon: '"',
    toolbarKey: TOOLBAR_KEYS.BLOCKQUOTE,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
];

export interface SlashCommandsOptions {
  toolbarItems: ToolbarItems;
  onSuggestionActiveChange: ((active: boolean) => void) | null;
  extraItems: SlashCommandItem[];
}

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: 'slashCommands',

  addOptions() {
    return {
      toolbarItems: {} as ToolbarItems,
      onSuggestionActiveChange: null,
      extraItems: [],
    };
  },

  addProseMirrorPlugins() {
    const { toolbarItems, onSuggestionActiveChange, extraItems } = this.options;

    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        pluginKey: SlashCommandsPluginKey,
        char: '/',
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        items: ({ query }) => {
          const enabled = [
            ...COMMAND_ITEMS.filter((item) => !item.toolbarKey || toolbarItems[item.toolbarKey] !== false),
            ...extraItems,
          ];
          const q = query.toLowerCase().trim();
          if (!q) return enabled;
          return enabled.filter(
            (item) => item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
          );
        },
        render: createSuggestionRender(SlashList, (props) => ({ ...props, command: props.command }), onSuggestionActiveChange ?? undefined),
      }),
    ];
  },
});
