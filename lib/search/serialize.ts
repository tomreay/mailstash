import type { ParsedSearchQuery } from './query-parser';

/** Wraps a value in quotes when it contains whitespace. */
function quoteIfNeeded(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Renders a parsed query back into search-box text.
 *
 * The filter widgets edit a ParsedSearchQuery and hand it back here, so the
 * text box always shows the true query — toggling "unread" writes `is:unread`
 * into the box, and typing `is:unread` lights up the toggle.
 */
export function serializeSearchQuery(query: ParsedSearchQuery): string {
  const parts: string[] = [];

  for (const value of query.from) parts.push(`from:${quoteIfNeeded(value)}`);
  for (const value of query.to) parts.push(`to:${quoteIfNeeded(value)}`);
  for (const value of query.subject) {
    parts.push(`subject:${quoteIfNeeded(value)}`);
  }
  for (const value of query.body) parts.push(`body:${quoteIfNeeded(value)}`);

  if (query.hasAttachment === true) parts.push('has:attachment');
  if (query.hasAttachment === false) parts.push('has:none');
  if (query.isRead !== undefined) {
    parts.push(query.isRead ? 'is:read' : 'is:unread');
  }
  if (query.after) parts.push(`after:${formatDate(query.after)}`);
  if (query.before) parts.push(`before:${formatDate(query.before)}`);

  for (const phrase of query.phrases) parts.push(`"${phrase}"`);
  parts.push(...query.terms);

  return parts.join(' ');
}
