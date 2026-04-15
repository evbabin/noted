import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface NoteEditorProps {
  noteId: string;
  initialContent: unknown;
  onChange: (content: unknown) => void;
  editable?: boolean;
  placeholder?: string;
}

export function NoteEditor({
  noteId,
  initialContent,
  onChange,
  editable = true,
}: NoteEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: (initialContent as object | null | undefined) ?? '',
    editable,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm sm:prose-base max-w-none min-h-[50vh] focus:outline-none',
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON());
    },
  });

  // Swap content when the route lands on a different note (prevents editing a
  // stale doc when the user clicks to a different note in the sidebar).
  useEffect(() => {
    if (editor) {
      editor.commands.setContent(
        (initialContent as object | null | undefined) ?? '',
        false,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  if (!editor) {
    return <p className="text-sm text-gray-500">Loading editor…</p>;
  }

  return (
    <div>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="mt-3" />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-xs font-medium transition ${
      active ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive('bold'))}
      >
        Bold
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive('italic'))}
      >
        Italic
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive('heading', { level: 2 }))}
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive('heading', { level: 3 }))}
      >
        H3
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive('bulletList'))}
      >
        • List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive('orderedList'))}
      >
        1. List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btn(editor.isActive('codeBlock'))}
      >
        Code
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive('blockquote'))}
      >
        Quote
      </button>
    </div>
  );
}

export default NoteEditor;
