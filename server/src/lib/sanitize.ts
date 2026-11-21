import sanitizeHtml from 'sanitize-html';

/** Rich text from the admin editor → safe HTML. Bold, lists, headings and links survive; scripts never do. */
export function cleanHtml(input: string): string {
  return sanitizeHtml(markdownish(input), {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'a', 'hr', 'span'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }) },
  });
}

/**
 * Admins often paste text with *bold* and "- " bullets (from WhatsApp / ChatGPT).
 * Convert those to real HTML so customers never see raw asterisks.
 */
function markdownish(s: string): string {
  if (/<\/?(p|ul|ol|li|strong|br|h[2-4])\b/i.test(s)) return s; // already HTML from the editor
  const lines = s.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let list: string[] | null = null;
  const inline = (t: string) =>
    t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>');
  const flush = () => {
    if (list) out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^[-•*]\s+(.*)$/);
    if (m) {
      (list ??= []).push(m[1]);
      continue;
    }
    flush();
    if (!line) continue;
    const h = line.match(/^#{1,3}\s+(.*)$/);
    out.push(h ? `<h3>${inline(h[1])}</h3>` : `<p>${inline(line)}</p>`);
  }
  flush();
  return out.join('');
}

export function stripTags(s: string): string {
  return sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
}
