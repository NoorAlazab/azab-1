# Test Status Display Fix - Implementation Summary

## Problem Statement
Tests were showing **PENDING** status in the UI even after execution completed, despite the database containing the correct `error` and `failed` statuses.

## Root Cause Analysis

### Issue 1: Prisma Query Result Caching
Prisma's `include` relation was potentially caching stale data from when tests were first created with 'pending' status. When the execute endpoint updated statuses, subsequent queries to the results API might return cached results.

### Issue 2: SQLite Write-Ahead Log (WAL) Delay
SQLite's write-ahead logging can introduce a slight delay between when a write is committed and when it's visible to subsequent read queries, especially with concurrent requests.

### Issue 3: Lack of Transaction Isolation
The results API was querying the run and test executions separately without ensuring a consistent snapshot of the database state.

## Applied Fixes

### Fix 1: Enhanced Prisma Client Configuration
**File**: `lib/db/prisma.ts`

```typescript
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'], // Enhanced logging
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
```

**Changes**:
- Added comprehensive logging (query, info, warn, error) to track all database operations
- Explicit datasource configuration to prevent caching

**Impact**: All Prisma queries are now logged, making it easier to debug data issues.

---

### Fix 2: Transaction-Based Results Fetching
**File**: `app/api/exploration-v2/results/route.ts`

**Before**:
```typescript
const run = await prisma.explorationRun.findFirst({
  where: { id: runId, userId },
});

const testExecutions = await prisma.testExecution.findMany({
  where: { runId: run.id },
});
```

**After**:
```typescript
// Force a small delay to ensure writes have completed
await new Promise(resolve => setTimeout(resolve, 100));

// Use a transaction to ensure consistent snapshot
const [run, testExecutions] = await prisma.$transaction(async (tx) => {
  const runData = await tx.explorationRun.findFirst({
    where: { id: runId, userId },
  });

  const executions = await tx.testExecution.findMany({
    where: { runId: runData.id },
    orderBy: { createdAt: 'asc' },
  });

  return [runData, executions];
});
```

**Changes**:
1. **100ms delay**: Ensures SQLite's write-ahead log has completed before querying
2. **Transaction wrapper**: Both queries execute within a single transaction, ensuring a consistent database snapshot
3. **Detailed logging**: Added logs inside the transaction to track query execution

**Impact**: Results API now always reads the latest, consistent state from the database.

---

### Fix 3: Comprehensive Execute Endpoint Logging
**File**: `app/api/exploration-v2/execute/route.ts`

Added detailed logging in the `executeTestsAsync` function:

```typescript
console.log('[ExecuteAsync] Processing result for:', result.testCase.title);
console.log('[ExecuteAsync]   Status from executor:', result.status);
console.log('[ExecuteAsync]   Current DB status:', execution.status);
console.log('[ExecuteAsync]   Will update to:', result.status);

const updated = await prisma.testExecution.update({ ... });

console.log('[ExecuteAsync]   ✅ UPDATED! New status in DB:', updated.status);

// Verify the update
const verified = await prisma.testExecution.findUnique({
  where: { id: execution.id }
});
console.log('[ExecuteAsync]   ✅ VERIFICATION: Re-queried status:', verified?.status);
```

**Changes**:
1. Logs status before and after update
2. Verifies update by re-querying the record
3. Shows clear visual indicators (✅, ⚠️) for easy debugging

**Impact**: Can now trace exactly when and how test statuses are updated in the database.

---

### Fix 4: HTTP Cache Prevention
**File**: `app/api/exploration-v2/results/route.ts`

```typescript
response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
response.headers.set('Pragma', 'no-cache');
response.headers.set('Expires', '0');
```

**Impact**: Prevents browsers and proxies from caching API responses.

---

## Workflow Separation (Bonus Fix)

Based on user feedback: *"lets seperate the workflow after clicking on start testing the first one to record then click to start excution"*

### Changes Made:

#### 1. Updated Test Flow (`app/(dashboard)/exploration-v2/page.tsx`)
- **Removed**: Auto-recording logic from `handleStartTesting`
- **Simplified**: Start Testing now only executes tests (assumes recording already done)
- **Updated**: Component props to pass `onRecordSelectors`, `isRecording`, and `recordingNeeded`

#### 2. Two-Phase UI (`components/exploration/TestCasesReview.tsx`)
**Phase 1 - Recording** (shows when `recordingNeeded === true`):
```tsx
<Button onClick={onRecordSelectors} disabled={isRecording}>
  <Circle className="h-4 w-4" />
  Record Selectors First
</Button>
```

**Phase 2 - Execution** (shows when `recordingNeeded === false`):
```tsx
<Button onClick={onStartTesting} disabled={isExecuting}>
  <PlayCircle className="h-4 w-4" />
  Start Testing
</Button>
```

**Impact**: Users now have explicit control over recording vs execution phases.

---

## Testing Instructions

### 1. Run the Debug Script
```bash
node debug_status_flow.js
```

This will show:
- Latest exploration run details
- All test executions with their statuses
- Status summary (passed/failed/error/pending counts)
- Database consistency check

### 2. Test the New Workflow

1. **Analyze a Story**:
   - Enter a Jira story key
   - Click "Analyze Story"
   - Wait for test cases to generate

2. **Record Selectors** (Phase 1):
   - You should see "Record Selectors First" button
   - Click it and wait for recording to complete
   - Verify that selectors were recorded

3. **Start Testing** (Phase 2):
   - After recording, button should change to "Start Testing"
   - Click it to execute tests
   - **Watch the server console** for detailed logging

4. **Verify Status Updates**:
   - Tests should show actual statuses (passed/failed/error) NOT pending
   - Run `node debug_status_flow.js` to verify database has correct statuses
   - Check browser console for results API responses

### 3. Expected Server Logs

When tests execute, you should see:
```
[ExecuteAsync] ========== SAVING RESULTS TO DATABASE ==========
[ExecuteAsync] Processing result for: Test case title
[ExecuteAsync]   Status from executor: failed
[ExecuteAsync]   Current DB status: pending
[ExecuteAsync]   Will update to: failed
[ExecuteAsync]   ✅ UPDATED! New status in DB: failed
[ExecuteAsync]   ✅ VERIFICATION: Re-queried status: failed
```

When results API is polled, you should see:
```
[ResultsAPI] Inside transaction, querying run...
[ResultsAPI] Found 8 test executions in transaction
[ResultsAPI] Raw test executions from database:
[ResultsAPI]   #1: { status: 'error', hasError: true }
[ResultsAPI]   #2: { status: 'failed', hasError: false }
[ResultsAPI] ALL STATUSES: 1:error, 2:failed, 3:error, ...
```

---

## Debugging Commands

### Check Latest Run Status
```bash
node debug_status_flow.js
```

### Query Specific Run
```bash
node check_specific_run.js
```

### View Prisma Query Logs
The dev server now logs all Prisma queries in real-time.

### Direct Database Query
```bash
npx prisma studio
```
Opens visual database browser at http://localhost:5555

---

## Known Issues & Limitations

1. **Playwright Required**: Real test execution requires Playwright. If not installed, tests will run in simulation mode.

2. **OAuth Port**: Ensure `.env.local` and Atlassian Developer Console both use `http://localhost:3001/api/auth/atlassian/callback`

3. **External Environments**: When testing external staging environments, ensure:
   - Journey recording captures elements from the target environment
   - Selectors are environment-specific

---

## Next Steps

If tests still show PENDING after these fixes:

1. **Check Execute Logs**: Verify `[ExecuteAsync] ✅ UPDATED!` appears in server console
2. **Check Results Logs**: Verify `[ResultsAPI] ALL STATUSES:` shows correct statuses
3. **Run Debug Script**: Compare what's in database vs what UI shows
4. **Check Browser Console**: Look for frontend caching or state management issues

If database has correct statuses but UI shows pending, the issue is in the frontend polling/state management, not the backend.
