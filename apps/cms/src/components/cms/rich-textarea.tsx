"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { plainToEditorHtml, editorHtmlToPlain } from "@/lib/rich-text-markdown";

const BOLD_ICON = "M6 4h6.5a3.5 3.5 0 0 1 0 7H6zM6 11h7.5a3.5 3.5 0 0 1 0 7H6z";
const ITALIC_ICON = "M11 4h6M7 20h6M14 4L10 20";
const HIGHLIGHT_ICON = "M9 15l6-6M4 20l3-1 9-9-2-2-9 9-1 3zM15 5l4 4";

function ToolbarButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid size-7 flex-none place-items-center rounded-md border transition-colors ${
        active ? "border-brand bg-accent text-accent-fg" : "border-transparent text-ink-soft hover:border-border-soft hover:bg-background hover:text-ink"
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
    </button>
  );
}

/**
 * Editor de texto WYSIWYG (TipTap) para párrafos/descripciones — negritas,
 * cursiva y acento se ven aplicados de verdad mientras se escribe, no como
 * `**`/`*`/`==` sueltos en el texto. El formato de almacenamiento no cambia:
 * plainToEditorHtml()/editorHtmlToPlain() traducen hacia/desde el mismo texto
 * plano de siempre — ni el backend ni la-mira necesitaron tocarse para esto.
 */
export function RichTextarea({
  id,
  value,
  onChange,
  rows = 3,
  placeholder,
  required,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  required?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, bulletList: false, orderedList: false, blockquote: false, codeBlock: false, horizontalRule: false }),
      Highlight.configure({ HTMLAttributes: { class: "accent-mark" } }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: plainToEditorHtml(value),
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editorHtmlToPlain(editor.getHTML())),
    editorProps: {
      attributes: { id: id ?? "" },
    },
  });

  // Sincroniza cuando `value` cambia desde AFUERA del editor (ej. "Mejorar con
  // IA" reemplaza el texto, o se carga un borrador ya generado) — sin esto el
  // editor se quedaría mostrando el texto viejo.
  useEffect(() => {
    if (!editor) return;
    const current = editorHtmlToPlain(editor.getHTML());
    if (current !== value) editor.commands.setContent(plainToEditorHtml(value), { emitUpdate: false });
  }, [value, editor]);

  if (!editor) {
    return <div className="rounded-[10px] border border-border bg-white" style={{ minHeight: `${rows * 1.6}em` }} />;
  }

  return (
    <div className={`rounded-[10px] border border-border bg-white transition-colors focus-within:border-ink-faint ${required && !value.trim() ? "border-[#F0B8B4]" : ""}`}>
      <div className="flex items-center gap-1 border-b border-border-soft px-2 py-1.5">
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} icon={BOLD_ICON} label="Negritas" />
        <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} icon={ITALIC_ICON} label="Cursiva" />
        <ToolbarButton active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} icon={HIGHLIGHT_ICON} label="Color de acento" />
      </div>
      <EditorContent editor={editor} style={{ minHeight: `${rows * 1.6}em` }} className="px-3 py-2 text-[13.5px] leading-[1.6] text-ink [&_.ProseMirror]:outline-none" />
    </div>
  );
}
