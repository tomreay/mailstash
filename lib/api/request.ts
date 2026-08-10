import { z } from 'zod';
import { ValidationError } from './errors';

/**
 * Parses and validates URL search params against a zod schema.
 * Throws {@link ValidationError} (→ 400) on failure.
 *
 * Coerce numeric/boolean fields in the schema (e.g. `z.coerce.number()`), since
 * query values are always strings.
 */
export function parseQuery<S extends z.ZodType>(
  request: Request,
  schema: S
): z.infer<S> {
  const { searchParams } = new URL(request.url);
  const raw = Object.fromEntries(searchParams.entries());
  return schema.parse(raw);
}

/**
 * Parses and validates a JSON request body against a zod schema.
 * Throws {@link ValidationError} (→ 400) on invalid JSON or schema mismatch.
 */
export async function parseJson<S extends z.ZodType>(
  request: Request,
  schema: S
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }
  return schema.parse(body);
}
