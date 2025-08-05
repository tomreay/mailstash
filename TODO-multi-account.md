# Multi-Account Support Implementation TODO

## Overview
This document tracks the implementation of multi-account support, allowing users to view and configure multiple email accounts with individual settings for sync, filtering, and auto-deletion.

## Current Status
- [x] Basic multi-account infrastructure exists (EmailAccount model with userId)
- [x] Google OAuth auto-creates email account on sign-in
- [x] Phase 1: Database & API Foundation complete
- [ ] Full multi-account UI and configuration features needed

---

## Phase 1: Database & API Foundation ✅
- [x] Create AccountSettings model in schema.prisma
  - [x] Define sync frequency options (uses cron expressions)
  - [x] Define label filtering fields  
  - [x] Define auto-delete configuration fields
- [x] Create and run database migration
- [x] Update existing API endpoints to support accountId filtering
  - [x] GET /api/emails - Add optional accountId parameter
  - [x] GET /api/stats - Add optional accountId parameter for per-account stats
  - [x] GET /api/stats - Return aggregate stats when no accountId provided
- [x] Create account management API endpoints
  - [x] GET /api/accounts - List all user accounts with basic info
  - [x] POST /api/accounts - Add new account (IMAP support)
  - [x] GET /api/accounts/[id] - Get account details with settings
  - [x] PUT /api/accounts/[id]/settings - Update account settings
  - [x] DELETE /api/accounts/[id] - Remove account and cascade delete data
  - [x] GET /api/accounts/[id]/labels - Get available labels/folders for filtering

### Phase 1 Accomplishments
- Created AccountSettings model with all configuration fields
- Applied database schema changes successfully (via db push)
- Created manual migration file for production deployment
- Implemented clean architecture with DAO and Service layers
- All API endpoints are type-safe and follow best practices
- Updated sync frequency to use cron expressions instead of nextSyncAt
- Ready for UI implementation in Phase 2

## Phase 2: Account Management UI ✅
- [x] Create /app/accounts/page.tsx - Account list page
  - [x] Display all user accounts in cards/list
  - [x] Show per-account stats (emails, storage, last sync)
  - [x] Add "Add Account" button with provider options
  - [x] Quick actions (sync now, settings, delete)
- [x] Create /app/accounts/new/page.tsx - Add account wizard
  - [x] Account type selection (Gmail OAuth, IMAP)
  - [x] OAuth flow integration for Gmail
  - [x] IMAP credentials form with validation
  - [x] Initial settings configuration step
- [x] Create /app/accounts/[id]/settings/page.tsx - Account settings
  - [x] Display current account info
  - [x] Settings form with sections for each category
  - [x] Save/cancel actions with loading states
  - [x] Delete account with confirmation dialog

### Phase 2 Accomplishments
- Created comprehensive account management UI with three main pages
- Implemented account list with stats display and quick actions
- Built add account wizard supporting both Gmail OAuth and IMAP
- Created full-featured settings page with tabs for sync, filters, and auto-delete
- Added all required UI components (input, label, switch, select, checkbox, tabs)
- Fixed all TypeScript errors and ensured clean production build
- Followed consistent patterns with existing pages in the codebase

## Phase 3: Settings Implementation ✅
- [x] Implement label/folder filtering
  - [x] Create LabelSelector component with checkbox tree
  - [x] Fetch available labels from provider
  - [x] Support include/exclude modes
  - [x] Visual indication of selected labels
  - [ ] Apply filters during sync operations
- [x] Implement sync frequency settings
  - [x] Cron expression input with presets:
    - Manual: "manual" (no automatic sync)
    - Every 15 minutes: "*/15 * * * *"
    - Every 30 minutes: "*/30 * * * *"
    - Hourly: "0 * * * *"
    - Every 2/6/12 hours
    - Daily at midnight: "0 0 * * *"
    - Daily at 2 AM: "0 2 * * *"
    - Weekly on Sunday/Monday: "0 0 * * 0/1"
    - Monthly: "0 0 1 * *"
    - Custom expression support
  - [x] Cron expression validator and preview
  - [x] Manual sync trigger button
  - [x] Pause/resume sync toggle
  - [ ] Update background job scheduling with cron
- [x] Implement auto-delete settings
  - [x] Enable/disable toggle with warning
  - [x] Delete delay configuration (hours after import)
  - [x] Delete by age selector (months old)
  - [x] Archive-only option checkbox
  - [x] Test run mode for previewing deletions
  - [ ] Create auto-delete background job

### Phase 3 Accomplishments
- Created advanced UI components for settings management:
  - **LabelSelector**: Hierarchical tree view with folder structure, indeterminate checkbox states, and bulk selection
  - **SyncFrequencySelector**: Cron expression support with validation, human-readable previews, and manual sync trigger
  - **AutoDeleteSettings**: Comprehensive deletion rules with presets, test mode, and visual warnings
- Implemented full-featured settings UI with improved UX:
  - Visual feedback for all settings changes
  - Real-time validation and error handling
  - Clear warnings for destructive operations
  - Test/preview capabilities before applying changes
- Added Slider UI component for future enhancements
- All components follow consistent design patterns and are fully type-safe

## Phase 4: Dashboard Updates
- [ ] Add account selector to header/dashboard
  - [ ] Dropdown with account avatars/names
  - [ ] "All Accounts" option (default)
  - [ ] Store selected account in context/localStorage
- [ ] Update StatsCards component
  - [ ] Accept optional accountId prop
  - [ ] Fetch aggregate stats when no accountId
  - [ ] Show per-account breakdown in aggregate mode
  - [ ] Add account indicator to each stat
- [ ] Update email list components
  - [ ] Filter by selected account
  - [ ] Show account badge on emails in aggregate view
  - [ ] Update search to work across accounts
- [ ] Update RecentActivity component
  - [ ] Show account info in activity items
  - [ ] Filter by selected account

## Phase 5: Background Jobs
- [ ] Update job payload types to include settings snapshot
  - [ ] Extend SyncJobPayload with accountSettings field
  - [ ] Include label filters, sync preferences in payload
  - [ ] Ensure settings are immutable during job execution
- [ ] Update sync job handlers
  - [ ] Read settings from job payload instead of database
  - [ ] Apply label filters when fetching emails
  - [ ] Skip excluded labels/folders based on payload settings
  - [ ] Update sync status per account
- [ ] Create auto-delete job handler
  - [ ] Include delete settings in job payload
  - [ ] Check delete conditions (delay, age, archived) from payload
  - [ ] Call provider API to delete from server
  - [ ] Mark as deleted in local database
  - [ ] Log deletion activities with settings used
- [ ] Implement scheduled sync based on cron expressions
  - [ ] Use node-cron or similar library for scheduling
  - [ ] Register cron jobs for each account on startup
  - [ ] Update cron job when settings change
  - [ ] Snapshot current settings when queuing jobs
  - [ ] Queue sync jobs with settings snapshot
  - [ ] Handle timezone considerations
  - [ ] Skip paused accounts


## Implementation Order
1. Database schema and migrations
2. API endpoints
3. Basic account list UI
4. Account settings UI
5. Settings implementation
6. Dashboard updates
7. Background job updates

## Success Criteria
- [ ] Users can add multiple email accounts (Gmail and IMAP)
- [ ] Each account has independent settings
- [ ] Label filtering works correctly per account
- [ ] Auto-delete functions as configured
- [ ] Dashboard shows accurate aggregate and per-account stats
- [ ] Sync frequency is respected per account
- [ ] All account data is properly cleaned up on deletion

## Architectural Improvements

### Clean Architecture Implementation ✅
- **DAO Layer** (`/lib/dao/`): All database operations isolated
  - `accounts.dao.ts`: Account data access methods
  - `emails.dao.ts`: Email data access methods
  - `stats.dao.ts`: Statistics data access methods
- **Service Layer** (`/lib/services/`): Business logic separated from data access
  - `accounts.service.ts`: Account management logic
  - `emails.service.ts`: Email processing logic
  - `stats.service.ts`: Statistics aggregation logic
- **Route Handlers**: Clean, focused on HTTP concerns only

### Settings Consistency During Sync
- **Solution**: Embed AccountSettings snapshot in job payload
- **Benefits**: 
  - Settings changes don't affect running syncs
  - Consistent behavior throughout job execution
  - Audit trail of settings used for each sync

### Example Job Payload Structure
```typescript
interface EnhancedSyncJobPayload extends SyncJobPayload {
  accountId: string;
  accountSettings: {
    syncFrequency: string;
    includeLabels: string[];
    excludeLabels: string[];
    autoDeleteEnabled: boolean;
    deleteDelay?: number;
    deleteAge?: number;
    deleteOnlyArchived: boolean;
  };
  // Original sync data
  lastSyncAt?: string;
  gmailHistoryId?: string;
}
```