import { simpleParser } from 'mailparser';

/**
 * Upper bound on the plain text stored per email. Full bodies stay in the EML
 * file on disk; this copy exists only to be indexed, and a handful of
 * pathological emails (long base64 blobs, giant quoted threads) would
 * otherwise dominate the table and the index.
 */
export const MAX_BODY_TEXT_LENGTH = 100_000;

/** Strips tags from an HTML body to leave indexable prose. */
function htmlToText(html: string): string {
  return (
    html
      // Drop script/style bodies wholesale — they are never useful to search.
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  );
}

/** Collapses runs of whitespace so the stored text stays compact. */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts the searchable plain-text body from a raw RFC822 message.
 *
 * Prefers the text/plain part and falls back to a tag-stripped HTML part.
 * Returns null when the message has no usable body, so callers can leave the
 * column NULL rather than storing an empty string.
 */
export async function extractBodyText(
  rawContent: string
): Promise<string | null> {
  try {
    const parsed = await simpleParser(rawContent);

    const source =
      parsed.text ||
      (typeof parsed.html === 'string' ? htmlToText(parsed.html) : '');

    const text = normalize(source);
    if (!text) return null;

    return text.length > MAX_BODY_TEXT_LENGTH
      ? text.slice(0, MAX_BODY_TEXT_LENGTH)
      : text;
  } catch {
    // A body we cannot parse simply is not searchable; it must not break the
    // sync or import that produced it.
    return null;
  }
}
