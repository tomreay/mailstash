-- Plain-text copy of the email body, populated at sync/import time from the
-- parsed EML. Existing rows are backfilled by scripts/backfill-body-text.ts.
ALTER TABLE "emails" ADD COLUMN "bodyText" TEXT;

-- Weighted full-text search vector. Subject ranks highest, then the
-- participants, then the body, so a subject hit beats a passing body mention.
-- 'simple' is deliberate for from/to: it does not stem, so addresses and
-- domains survive tokenisation intact.
ALTER TABLE "emails" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("subject", '')), 'A') ||
    setweight(to_tsvector('simple',  coalesce("from", '')), 'B') ||
    setweight(to_tsvector('simple',  coalesce("to", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("bodyText", '')), 'C')
  ) STORED;

CREATE INDEX "emails_search_vector_idx" ON "emails" USING GIN ("searchVector");

-- Trigram indexes back the substring operators (from:/to:/subject:), which
-- need infix matching that a tsvector cannot answer.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "emails_from_trgm_idx" ON "emails" USING GIN ("from" gin_trgm_ops);
CREATE INDEX "emails_to_trgm_idx" ON "emails" USING GIN ("to" gin_trgm_ops);
CREATE INDEX "emails_subject_trgm_idx" ON "emails" USING GIN ("subject" gin_trgm_ops);
