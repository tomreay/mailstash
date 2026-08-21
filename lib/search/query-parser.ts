/**
 * Parser for the email search mini-language.
 *
 * Supported syntax:
 *   from:alice@example.com      substring match on the From header
 *   to:bob                      substring match on the To header
 *   subject:"quarterly report"  substring match on the subject
 *   body:electrician            full-text match restricted to the body
 *   has:attachment              only emails with attachments
 *   is:unread / is:read         read state
 *   after:2025-01-01            on or after this date
 *   before:2025-06-30           strictly before this date
 *   "exact phrase"              quoted phrase, full-text
 *   anything else               free-text, full-text over subject/from/to/body
 *
 * Operator values may be quoted to include spaces. An unrecognised `word:`
 * prefix is not treated as an operator — it falls through to free text, so
 * searching for something like "re: lunch" still behaves sensibly.
 */

export interface ParsedSearchQuery {
  /** Free-text terms, to be matched with full-text search. */
  terms: string[];
  /** Quoted phrases, which must match as contiguous phrases. */
  phrases: string[];
  from: string[];
  to: string[];
  subject: string[];
  /** Terms restricted to the message body. */
  body: string[];
  hasAttachment?: boolean;
  isRead?: boolean;
  /** Inclusive lower bound on the email date. */
  after?: Date;
  /** Exclusive upper bound on the email date. */
  before?: Date;
}

const FIELD_OPERATORS = ['from', 'to', 'subject', 'body'] as const;
type FieldOperator = (typeof FIELD_OPERATORS)[number];

/** Every operator keyword, used to recognise `from: alice` as `from:alice`. */
const KNOWN_OPERATORS = [
  ...FIELD_OPERATORS,
  'has',
  'is',
  'after',
  'before',
] as const;

/**
 * Splits a query into tokens, treating a double-quoted run as a single token.
 * Returns the raw text of each token alongside whether it was quoted, since
 * `"exact phrase"` and `exact phrase` mean different things downstream.
 */
interface Token {
  text: string;
  quoted: boolean;
}

/**
 * Operators are accepted with whitespace after the colon (`from: alice`), so
 * that the natural way people type them still works. Collapsing the space up
 * front lets the tokenizer treat both spellings identically.
 */
function collapseOperatorSpacing(input: string): string {
  return input.replace(
    new RegExp(`\\b(${KNOWN_OPERATORS.join('|')}):\\s+`, 'gi'),
    '$1:'
  );
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  // Either `key:"quoted value"`, or `"quoted value"`, or a bare run of
  // non-whitespace. The key stays attached so operators survive tokenizing.
  const pattern = /(\w+:)?"([^"]*)"|(\S+)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    const [, key, quotedValue, bareToken] = match;

    if (quotedValue !== undefined) {
      tokens.push({ text: `${key ?? ''}${quotedValue}`, quoted: true });
    } else if (bareToken) {
      tokens.push({ text: bareToken, quoted: false });
    }
  }

  return tokens;
}

function parseHasValue(value: string): boolean | undefined {
  const normalized = value.toLowerCase();
  if (['attachment', 'attachments', 'true', 'yes'].includes(normalized)) {
    return true;
  }
  if (['false', 'no', 'none'].includes(normalized)) return false;
  return undefined;
}

/**
 * Parses a `YYYY-MM-DD` (or any Date-parseable) value.
 * Returns undefined for values Postgres could not meaningfully compare.
 */
function parseDate(value: string): Date | undefined {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function parseSearchQuery(input: string | undefined): ParsedSearchQuery {
  const query: ParsedSearchQuery = {
    terms: [],
    phrases: [],
    from: [],
    to: [],
    subject: [],
    body: [],
  };

  if (!input?.trim()) return query;

  for (const token of tokenize(collapseOperatorSpacing(input))) {
    const separatorIndex = token.text.indexOf(':');

    if (separatorIndex > 0) {
      const key = token.text.slice(0, separatorIndex).toLowerCase();
      const value = token.text.slice(separatorIndex + 1).trim();

      if (value) {
        if ((FIELD_OPERATORS as readonly string[]).includes(key)) {
          query[key as FieldOperator].push(value);
          continue;
        }

        if (key === 'has') {
          const hasAttachment = parseHasValue(value);
          if (hasAttachment !== undefined) {
            query.hasAttachment = hasAttachment;
            continue;
          }
        }

        if (key === 'is') {
          const normalized = value.toLowerCase();
          if (normalized === 'unread' || normalized === 'read') {
            query.isRead = normalized === 'read';
            continue;
          }
        }

        if (key === 'after' || key === 'before') {
          const date = parseDate(value);
          if (date) {
            query[key] = date;
            continue;
          }
        }
      }
      // Unrecognised operator, or one with an unusable value: fall through and
      // treat the whole token as ordinary search text.
    }

    if (token.quoted) {
      query.phrases.push(token.text);
    } else {
      query.terms.push(token.text);
    }
  }

  return query;
}

/** True when the query has nothing that would constrain results. */
export function isEmptyQuery(query: ParsedSearchQuery): boolean {
  return (
    query.terms.length === 0 &&
    query.phrases.length === 0 &&
    query.from.length === 0 &&
    query.to.length === 0 &&
    query.subject.length === 0 &&
    query.body.length === 0 &&
    query.hasAttachment === undefined &&
    query.isRead === undefined &&
    query.after === undefined &&
    query.before === undefined
  );
}

/** True when the query has any full-text component (terms, phrases, body). */
export function hasFullTextComponent(query: ParsedSearchQuery): boolean {
  return (
    query.terms.length > 0 || query.phrases.length > 0 || query.body.length > 0
  );
}
