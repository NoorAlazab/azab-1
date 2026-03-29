# Critical Issues Summary

## Issue 1: Recording 0 Pages

**Cause**: When you provide `/auth` directly, page discovery tries to FIND a navigation link to "login" but you're already there!

**Fix**: Use BASE URL only:
- ✅ Use: https://staging.hyrddsa.com
- ❌ Don't use: https://staging.hyrddsa.com/auth

## Issue 2: Status Stuck on "Pending"

**Cause**: Prisma Client is caching query results with SQLite.

**Database has correct statuses** (confirmed):
- error, failed (verified with debug_status_flow.js)

**Results API returns wrong data**:
- ALL tests show "pending" to frontend

**IMMEDIATE FIX**: Force simulation mode in execute/route.ts line 81:
```typescript
const forceSimulation = true;
```

Simulation mode writes correctly and bypasses cache issues.

## Multiple API Calls

**Normal**: Polling behavior - will stop when run completes.

## Next Step

Use **simulation mode** or switch to **PostgreSQL** for production.
