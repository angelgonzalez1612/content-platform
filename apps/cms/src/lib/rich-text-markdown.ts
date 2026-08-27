// Puente entre el texto plano guardado (con **negritas**/*cursiva*/==acento==,
// el mismo formato que ya interpretan renderInline() en la vista previa y en
// la-mira real) y el HTML que espera un editor TipTap. A propósito NO se
// cambia el formato de almacenamiento — el editor de abajo es "solo UI": lo
// que se guarda en la DB, y lo que la-mira renderiza, sigue siendo el mismo
// texto plano de siempre. Nada en el backend ni en la-mira necesitó cambiar
// por esto.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function decodeHtmlEntities(s: string): string {
  return s.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (e) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[e]!);
}

function inlineMarkdownToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/==([^=]+)==/g, '<mark class="accent-mark">$1</mark>')
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function inlineHtmlToMarkdown(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<strong>([\s\S]*?)<\/strong>/g, "**$1**")
      .replace(/<mark[^>]*>([\s\S]*?)<\/mark>/g, "==$1==")
      .replace(/<em>([\s\S]*?)<\/em>/g, "*$1*")
      .replace(/<[^>]+>/g, ""),
  ).trim();
}

/** Texto plano guardado -> HTML inicial para el editor. */
export function plainToEditorHtml(text: string): string {
  if (!text.trim()) return "<p></p>";
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${inlineMarkdownToHtml(para) || "<br>"}</p>`)
    .join("");
}

/** HTML del editor (editor.getHTML()) -> texto plano para guardar. */
export function editorHtmlToPlain(html: string): string {
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  const blocks = paragraphs.length ? paragraphs : [html];
  return blocks.map(inlineHtmlToMarkdown).join("\n\n");
}
