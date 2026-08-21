/**
 * Builds Postgres `tsquery` strings from user input.
 *
 * The result is always passed to `to_tsquery()` as a bound parameter, never
 * interpolated into SQL. Even so, the input is sanitised here: `to_tsquery`
 * has its own syntax (`&`, `|`, `!`, `<->`, parentheses) and raw user text
 * containing those characters would be a syntax error rather than a search.
 */

/**
 * Anything that is not a letter, digit, underscore, or one of the few
 * characters that are meaningful *within* an address-like lexeme (`@`, `.`,
 * `-`). Allowlisting is deliberate: a denylist of tsquery operators would
 * still let stray punctuation such as `;` or `,` through, and `to_tsquery`
 * raises a syntax error on those rather than returning no rows.
 */
const NON_LEXEME = /[^\p{L}\p{N}_@.-]+/gu;

/** Leading/trailing punctuation is never part of a useful lexeme. */
const EDGE_PUNCTUATION = /^[@.-]+|[@.-]+$/g;

/**
 * Reduces a chunk of user text to bare lexeme words.
 * Returns [] when nothing searchable remains.
 */
function toLexemes(value: string): string[] {
  return value
    .replace(NON_LEXEME, ' ')
    .split(/\s+/)
    .map(lexeme => lexeme.replace(EDGE_PUNCTUATION, ''))
    .filter(Boolean);
}

/**
 * A single term becomes a prefix match (`word:*`) so that partial words
 * typed into the search box match as the user expects.
 */
function termToQuery(term: string): string | undefined {
  const lexemes = toLexemes(term);
  if (lexemes.length === 0) return undefined;
  // Multi-word after sanitising (e.g. "foo-bar") — require all parts.
  return lexemes.map(lexeme => `${lexeme}:*`).join(' & ');
}

/**
 * A phrase becomes a followed-by query (`a <-> b`) so the words must appear
 * adjacently and in order.
 */
function phraseToQuery(phrase: string): string | undefined {
  const lexemes = toLexemes(phrase);
  if (lexemes.length === 0) return undefined;
  return lexemes.join(' <-> ');
}

/**
 * Combines terms and phrases into one AND-ed tsquery.
 * Returns undefined when the input had no searchable content, in which case
 * the caller should skip the full-text condition entirely rather than run an
 * empty query (which matches nothing).
 */
export function buildTsQuery(options: {
  terms?: string[];
  phrases?: string[];
}): string | undefined {
  const parts = [
    ...(options.terms ?? []).map(termToQuery),
    ...(options.phrases ?? []).map(phraseToQuery),
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) return undefined;

  // Parenthesise each part so multi-lexeme parts AND correctly together.
  return parts.map(part => `(${part})`).join(' & ');
}
