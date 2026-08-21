import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import {
  isEmptyQuery,
  parseSearchQuery,
  type ParsedSearchQuery,
} from '@/lib/search/query-parser';
import { buildTsQuery } from '@/lib/search/tsquery';

export interface EmailQueryParams {
  page: number;
  limit: number;
  search?: string;
  accountId?: string;
  filter?: string;
}

export interface EmailListResult {
  emails: {
    id: string;
    messageId: string;
    subject: string | null;
    from: string;
    to: string;
    date: Date;
    isRead: boolean;
    isImportant: boolean;
    hasAttachments: boolean;
    labels: string | null;
    emlPath: string | null;
    markedForDeletion: boolean;
  }[];
  total: number;
}

/** Row shape returned by the raw search query. */
type EmailSearchRow = EmailListResult['emails'][number];

/**
 * Builds the WHERE fragments shared by the search count and page queries.
 *
 * Every user-supplied value is passed as a bound parameter — the only text
 * interpolated into SQL here is this module's own column names.
 */
function buildSearchConditions(
  accountIds: string[],
  params: EmailQueryParams,
  query: ParsedSearchQuery
): Prisma.Sql[] {
  const { accountId, filter } = params;
  const conditions: Prisma.Sql[] = [Prisma.sql`e."isDeleted" = false`];

  // Scope: a specific account when one is selected, otherwise every account
  // the user owns.
  if (accountId) {
    conditions.push(Prisma.sql`e."accountId" = ${accountId}`);
  } else {
    conditions.push(Prisma.sql`e."accountId" IN (${Prisma.join(accountIds)})`);
  }

  if (filter === 'marked-for-deletion') {
    conditions.push(Prisma.sql`e."markedForDeletion" = true`);
  }

  // Full-text: free terms and quoted phrases match anywhere in the document.
  const fullText = buildTsQuery({
    terms: query.terms,
    phrases: query.phrases,
  });
  if (fullText) {
    conditions.push(
      Prisma.sql`e."searchVector" @@ to_tsquery('english', ${fullText})`
    );
  }

  // body: terms are full-text too, but restricted to the body column.
  const bodyQuery = buildTsQuery({ terms: query.body });
  if (bodyQuery) {
    conditions.push(
      Prisma.sql`to_tsvector('english', coalesce(e."bodyText", '')) @@ to_tsquery('english', ${bodyQuery})`
    );
  }

  // Header operators are substring matches, backed by the trigram indexes.
  for (const value of query.from) {
    conditions.push(Prisma.sql`e."from" ILIKE ${`%${value}%`}`);
  }
  for (const value of query.to) {
    conditions.push(Prisma.sql`e."to" ILIKE ${`%${value}%`}`);
  }
  for (const value of query.subject) {
    conditions.push(Prisma.sql`e."subject" ILIKE ${`%${value}%`}`);
  }

  if (query.hasAttachment !== undefined) {
    conditions.push(Prisma.sql`e."hasAttachments" = ${query.hasAttachment}`);
  }
  if (query.isRead !== undefined) {
    conditions.push(Prisma.sql`e."isRead" = ${query.isRead}`);
  }
  if (query.after) {
    conditions.push(Prisma.sql`e."date" >= ${query.after}`);
  }
  if (query.before) {
    conditions.push(Prisma.sql`e."date" < ${query.before}`);
  }

  return conditions;
}

/**
 * Data Access Object for email-related database operations
 */
export class EmailsDAO {
  /**
   * Find emails with pagination and search.
   *
   * With no search text this is a plain Prisma query. With search text it
   * drops to raw SQL so results can be ranked by full-text relevance, which
   * Prisma's query builder cannot express.
   */
  static async findEmailsWithPagination(
    accountIds: string[],
    params: EmailQueryParams
  ): Promise<EmailListResult> {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    // No accounts means nothing to search; `IN ()` is not valid SQL.
    if (!params.accountId && accountIds.length === 0) {
      return { emails: [], total: 0 };
    }

    const query = parseSearchQuery(search);

    if (isEmptyQuery(query)) {
      return EmailsDAO.findEmailsUnfiltered(accountIds, params);
    }

    const conditions = buildSearchConditions(accountIds, params, query);
    const where = Prisma.join(conditions, ' AND ');

    // Rank by relevance when there is something to rank, then by recency.
    // Operator-only queries (e.g. `from:alice`) have no tsquery, so they fall
    // back to pure date ordering.
    const rankQuery = buildTsQuery({
      terms: query.terms,
      phrases: query.phrases,
    });
    const orderBy = rankQuery
      ? Prisma.sql`ORDER BY ts_rank(e."searchVector", to_tsquery('english', ${rankQuery})) DESC, e."date" DESC`
      : Prisma.sql`ORDER BY e."date" DESC`;

    const [emails, countRows] = await Promise.all([
      db.$queryRaw<EmailSearchRow[]>`
        SELECT
          e."id", e."messageId", e."subject", e."from", e."to", e."date",
          e."isRead", e."isImportant", e."hasAttachments", e."labels",
          e."emlPath", e."markedForDeletion"
        FROM "emails" e
        WHERE ${where}
        ${orderBy}
        LIMIT ${limit} OFFSET ${skip}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM "emails" e WHERE ${where}
      `,
    ]);

    return { emails, total: Number(countRows[0]?.count ?? 0) };
  }

  /**
   * The no-search path: a straightforward Prisma query.
   */
  private static async findEmailsUnfiltered(
    accountIds: string[],
    params: EmailQueryParams
  ): Promise<EmailListResult> {
    const { page, limit, accountId, filter } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.EmailWhereInput = {
      accountId: accountId ? accountId : { in: accountIds },
      isDeleted: false,
      ...(filter === 'marked-for-deletion' ? { markedForDeletion: true } : {}),
    };

    const [emails, total] = await Promise.all([
      db.email.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          messageId: true,
          subject: true,
          from: true,
          to: true,
          date: true,
          isRead: true,
          isImportant: true,
          hasAttachments: true,
          labels: true,
          emlPath: true,
          markedForDeletion: true,
        },
      }),
      db.email.count({ where }),
    ]);

    return { emails, total };
  }

  /**
   * Find email by ID and account ID
   */
  static async findEmailByIdAndAccount(emailId: string, accountId: string) {
    return await db.email.findFirst({
      where: {
        id: emailId,
        accountId,
        isDeleted: false,
      },
      include: {
        attachments: true,
        folder: true,
      },
    });
  }

  /**
   * Mark email as read
   */
  static async markAsRead(emailId: string) {
    return await db.email.update({
      where: { id: emailId },
      data: { isRead: true },
    });
  }
}
