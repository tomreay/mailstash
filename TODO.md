# Email Sync Architecture Improvement Plan

## Overview
This document tracks the phased implementation of a robust email sync architecture that can handle large inboxes (100k+ emails) with efficient incremental updates.

## Current Status
- [x] Architecture analysis completed
- [x] Phase 1: Database Migration
- [x] Phase 2: Background Job Infrastructure
- [ ] Phase 3: Sync Service Refactoring
- [ ] Phase 4: Incremental Sync Implementation
- [ ] Phase 5: Large Inbox Import Features
- [ ] Phase 6: API & UI Updates

---

## Phase 1: Database Migration to PostgreSQL
**Goal**: Switch from SQLite to PostgreSQL for better concurrency and scale

### Tasks
- [x] Update docker-compose.yml to include PostgreSQL service
- [x] Update .env.example with PostgreSQL connection string
- [x] Modify Prisma schema:
  - [x] Change provider from "sqlite" to "postgresql"
  - [x] Remove textContent and htmlContent from Email model
  - [x] Add sync tracking fields:
    - [x] gmailHistoryId to SyncStatus (already existed)
    - [x] lastImapUid to Folder model
    - [x] syncedAt timestamp to Email model
  - [x] Create SyncJob model for job queue
  - [x] Add proper indexes for large datasets
- [x] Update database initialization scripts
- [x] Test migration with sample data
- [x] Update code to read textContent and htmlContent from EML files

### Schema Changes
```prisma
model SyncJob {
  id           String   @id @default(cuid())
  type         String   // "full_sync", "incremental_sync", "folder_sync"
  status       String   // "pending", "processing", "completed", "failed"
  accountId    String
  metadata     Json?    // Job-specific data
  attempts     Int      @default(0)
  maxAttempts  Int      @default(3)
  scheduledAt  DateTime @default(now())
  startedAt    DateTime?
  completedAt  DateTime?
  error        String?
  
  @@index([status, scheduledAt])
  @@map("sync_jobs")
}
```

---

## Phase 2: Background Job Infrastructure
**Goal**: Implement PostgreSQL-based job queue without external dependencies

### Tasks
- [x] Create job queue service:
  - [x] Job creation and scheduling
  - [x] Job claiming with SKIP LOCKED (via graphile-worker)
  - [x] Job status updates
  - [x] Retry logic with exponential backoff
- [x] Create worker process:
  - [x] Polling mechanism for new jobs
  - [x] Job type routing
  - [x] Graceful shutdown handling
  - [x] Error handling and logging
- [x] Add job monitoring:
  - [x] Job status API endpoints
  - [x] Failed job alerts (via UI)
  - [x] Performance metrics (job counts)
- [x] Create job handlers:
  - [x] FullSyncHandler
  - [x] IncrementalSyncHandler
  - [x] FolderSyncHandler
  - [x] CleanupHandler

### Implementation Notes
- Use PostgreSQL's `SELECT ... FOR UPDATE SKIP LOCKED` for job claiming
- Implement heartbeat mechanism for long-running jobs
- Add dead letter queue for permanently failed jobs

---

## Phase 3: Sync Service Refactoring
**Goal**: Optimize sync performance for large datasets

### Tasks
- [ ] Split sync service into smaller modules:
  - [ ] EmailFetcher (handles API/IMAP communication)
  - [ ] EmailProcessor (processes and stores emails)
  - [ ] SyncOrchestrator (coordinates sync operations)
- [ ] Implement batch processing:
  - [ ] Batch database inserts (100-1000 records)
  - [ ] Batch file operations
  - [ ] Memory-efficient streaming
- [ ] Add progress tracking:
  - [ ] Real-time progress updates to database
  - [ ] Estimated completion time
  - [ ] Throughput metrics
- [ ] Optimize storage operations:
  - [ ] Parallel file writes
  - [ ] Async virus scanning
  - [ ] Cleanup orphaned files

### Performance Targets
- Process 1000 emails/minute minimum
- Memory usage < 500MB for any sync operation
- Support concurrent sync of multiple accounts

---

## Phase 4: Incremental Sync Implementation
**Goal**: Efficient updates for existing inboxes

### Tasks
- [ ] Gmail incremental sync:
  - [ ] Implement History API client
  - [ ] Track historyId per account
  - [ ] Process history changes (added/removed/modified)
  - [ ] Handle history gaps (fallback to full sync)
- [ ] IMAP incremental sync:
  - [ ] Track highest UID per folder
  - [ ] Implement UID-based fetching
  - [ ] Handle UID validity changes
  - [ ] Detect deleted messages
- [ ] Smart sync scheduling:
  - [ ] Different intervals per folder type
  - [ ] Activity-based scheduling
  - [ ] User-configurable schedules
- [ ] Change detection:
  - [ ] Email modifications (read/unread, labels)
  - [ ] Folder changes
  - [ ] Deletion handling

### Sync Intervals
- INBOX: Every 5 minutes
- Sent/Drafts: Every 15 minutes
- Other active folders: Every 30 minutes
- Archive folders: Daily

---

## Phase 5: Large Inbox Import Features
**Goal**: Handle initial import of 100k+ emails efficiently

### Tasks
- [ ] Chunked import strategy:
  - [ ] Time-based chunks (process by date ranges)
  - [ ] Size-based chunks (limit memory usage)
  - [ ] Priority processing (newest first)
- [ ] Resumable imports:
  - [ ] Save import state
  - [ ] Resume from last checkpoint
  - [ ] Handle partial failures
- [ ] Import optimization:
  - [ ] Parallel folder processing
  - [ ] Skip attachment downloads initially
  - [ ] Defer virus scanning
- [ ] User controls:
  - [ ] Pause/resume import
  - [ ] Cancel import
  - [ ] Choose folders to import
  - [ ] Set date ranges

### Import Workflow
1. Quick metadata scan (count emails, estimate time)
2. Create import job with checkpoints
3. Process in chunks with progress updates
4. Background attachment/scan processing
5. Completion notification

---

## Phase 6: API & UI Updates
**Goal**: Provide visibility and control over sync operations

### Tasks
- [ ] Progress tracking API:
  - [ ] GET /api/sync/progress
  - [ ] GET /api/sync/jobs
  - [ ] POST /api/sync/cancel
  - [ ] WebSocket endpoint for real-time updates
- [ ] Import management API:
  - [ ] POST /api/import/start
  - [ ] GET /api/import/status
  - [ ] POST /api/import/pause
  - [ ] POST /api/import/resume
- [ ] UI components:
  - [ ] Sync progress indicator
  - [ ] Import wizard
  - [ ] Sync history view
  - [ ] Error details modal
- [ ] Monitoring dashboard:
  - [ ] Account sync status
  - [ ] Performance metrics
  - [ ] Error logs
  - [ ] Storage usage

### UI Mockups Needed
- Import wizard with folder selection
- Progress bar with ETA
- Sync status dashboard
- Error recovery interface

---

## Testing Strategy

### Phase 1-2 Testing
- [ ] PostgreSQL connection and migrations
- [ ] Job queue correctness
- [ ] Worker process reliability

### Phase 3-4 Testing
- [ ] Performance benchmarks
- [ ] Memory usage tests
- [ ] Incremental sync accuracy

### Phase 5-6 Testing
- [ ] Large inbox import (100k+ emails)
- [ ] UI responsiveness during sync
- [ ] Error recovery scenarios

---

## Deployment Considerations

- PostgreSQL configuration for production
- Worker process management (systemd/supervisor)
- Monitoring and alerting setup
- Backup strategy for job queue
- Resource scaling guidelines

---

## Success Metrics

- Import 100k emails in < 2 hours
- Incremental sync < 30 seconds
- Memory usage < 500MB per sync
- 99.9% sync reliability
- Real-time progress accuracy

---

## Notes

- Development environment allows data deletion/recreation
- Focus on robustness over feature completeness
- Each phase should be independently deployable
- User feedback incorporated after each phase