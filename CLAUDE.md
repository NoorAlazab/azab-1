# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**QA CaseForge** is a Next.js 14 application for AI-powered test case generation and bug exploration from Jira user stories. It integrates with Atlassian Jira via OAuth 2.0 PKCE flow and uses Groq's API (llama-3.1-8b-instant model) for test case generation and automated bug detection.

## Core Architecture

### Authentication System

The app uses a **hybrid authentication architecture**:

1. **Password-based auth**: Primary login method with email/password (uses Argon2 for hashing)
2. **Email verification**: Required for new accounts via one-time tokens sent by Nodemailer
3. **Session management**: HTTP-only cookies with CSRF protection (7-day sessions)
4. **Jira OAuth**: Separate OAuth 2.0 PKCE flow for Jira integration stored in encrypted tokens

**Key files**:
- `lib/auth/session.ts` - Session creation/validation
- `lib/auth/emailTokens.ts` - Email verification token management
- `lib/oauth/atlassian.ts` - Jira OAuth PKCE implementation
- `lib/jira/tokenService.ts` - Encrypted Jira token storage/refresh

### Database Layer (Prisma + SQLite)

Database schema (`prisma/schema.prisma`):
- **User**: Core user accounts with password hashes and verification status
- **JiraConnection**: OAuth tokens (encrypted) and site associations
- **JiraToken**: Refresh tokens with automatic expiration tracking
- **TestSuite**: Generated test suites linked to Jira issues
- **TestCase**: Individual test cases with type, priority, and steps
- **ExplorationPlan**: AI-generated exploration objectives from user stories
- **ExplorationRun**: Execution records with environment and auth tracking
- **BugFinding**: Discovered bugs with severity, evidence, and Jira publishing status
- **VerificationToken**: One-time email verification tokens with expiration

**Database commands**:
```bash
# Generate Prisma client after schema changes
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name migration_name

# View database in Prisma Studio
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Jira Integration Architecture

**Multi-site OAuth flow**:
1. User connects via OAuth 2.0 PKCE (`/api/auth/atlassian/start`)
2. System fetches accessible sites (`GET /oauth/token/accessible-resources`)
3. User selects active site (stored in `activeCloudId`)
4. All Jira API calls use: `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...`

**Token management**:
- Access tokens refresh automatically before expiration
- Refresh tokens stored encrypted with AES-256-GCM
- Token service handles concurrent refresh requests safely
- See `lib/jira/tokenService.ts` for refresh logic

**Key Jira operations**:
- Issue fetch: `lib/jira/api.ts` - `fetchJiraIssue()`
- Publishing test cases: `lib/jira/subtask.ts` - `createTestSubtask()`
- Publishing bugs: `lib/jira/comment.ts` - `addCommentWithBugs()`
- Markdown ↔ ADF conversion: `lib/jira/adf.ts` and `lib/jira/markdown.ts`

### AI-Powered Features

**Test Case Generation** (`lib/ai/generateCases.ts`):
- Uses Groq API with llama-3.1-8b-instant model (free and fast)
- Supports multiple coverage types: functional, negative, boundary, accessibility, security, performance
- Structured output with priority (P0-P3) and detailed steps
- Configurable max cases (3-20)

**Automated Bug Exploration** (`lib/exploration/`):
- **Story Analyzer** (`story-analyzer.ts`): Extracts exploration objectives from user stories
- **Plan Generation** (`planFromStory.ts`): Creates structured exploration plans with objectives and scope
- **Bug Detector** (`bug-detector.ts`): AI-powered bug detection from exploration traces
- **Objective Quality** (`objectiveQuality.ts`): Validates exploration plan quality
- **Intent Classification** (`intent.ts`): Determines user story explorability

**AI Pipeline**:
1. User provides Jira story → Story analyzer extracts objectives
2. System generates exploration plan with scope and test objectives
3. (Future) Automated browser exploration executes plan
4. Bug detector analyzes traces and reports findings
5. Bugs published back to Jira as comments with severity ratings

### Frontend Architecture

**Stack**: React 18 + Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui

**Key patterns**:
- Server Actions for mutations (avoided in favor of API routes)
- Client-side state with TanStack Query (`@tanstack/react-query`)
- CSRF protection on all state-changing requests
- Form validation with Zod schemas
- Toast notifications via Sonner

**Page structure**:
```
app/
├── (auth)/              # Unauthenticated routes
│   ├── login/           # Password login
│   ├── jira-preflight/  # Pre-OAuth checks
│   └── oauth-debug/     # OAuth troubleshooting
├── (dashboard)/         # Protected routes (requires auth)
│   ├── dashboard/       # Main dashboard
│   ├── generator/       # Test case generation UI
│   ├── exploration/     # Legacy exploration interface
│   └── exploration-v2/  # New story-driven exploration
└── api/                 # API routes (see below)
```

**Component organization**:
- `components/ui/` - shadcn/ui primitives (button, card, input, etc.)
- `components/auth/` - Auth-related components (ConnectJiraButton, etc.)
- `components/dashboard/` - Dashboard widgets (QuickActions, ActivityFeed, etc.)
- `components/generator/` - Test generation UI (TestCaseEditor, StoryFetcher, etc.)
- `components/exploration/` - Exploration UI (RunsTable, FindingsModal, etc.)
- `components/layout/` - Layout components (AppHeader, AppSidebar, etc.)

### API Routes Structure

**Authentication** (`app/api/auth/`):
- `POST /api/auth/signup` - Create account (sends verification email)
- `POST /api/auth/login` - Password login (requires verified email)
- `GET /api/auth/verify?token=...` - Verify email token
- `POST /api/auth/verify/resend` - Resend verification email
- `GET /api/auth/session` - Get current session
- `POST /api/auth/logout` - Destroy session
- `GET /api/auth/csrf-token` - Get CSRF token for forms

**Jira OAuth** (`app/api/auth/atlassian/`):
- `POST /api/auth/atlassian/start` - Initiate OAuth flow (returns auth URL)
- `GET /api/auth/atlassian/callback` - Handle OAuth callback
- `GET /api/auth/atlassian/sites` - List accessible Jira sites
- `POST /api/auth/atlassian/site` - Set active site
- `POST /api/auth/atlassian/disconnect` - Revoke Jira connection

**Test Generation** (`app/api/generator/`):
- `POST /api/generator/draft` - Generate test cases from story
- `GET /api/generator/suite?issueKey=...` - Fetch saved suite
- `POST /api/generator/suite/save` - Save suite changes
- `POST /api/generator/case` - Create/update/delete individual test case
- `POST /api/generator/publish` - Publish suite to Jira as subtasks

**Exploration** (`app/api/exploration-v2/`):
- `POST /api/exploration-v2/start` - Start exploration from story
- `GET /api/exploration-v2/status?runId=...` - Check run status
- `POST /api/exploration-v2/bug` - Report bug finding
- `POST /api/exploration-v2/publish` - Publish bugs to Jira

**Jira API** (`app/api/jira/`):
- `GET /api/jira/me` - Get user profile and active site
- `GET /api/jira/search?q=...` - Search issues by key/summary
- `GET /api/jira/issue/[issueKey]` - Fetch issue details

## Development Commands

### Running the Application

```bash
# Development server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm start
```

### Code Quality

```bash
# Lint code
npm run lint

# Lint and auto-fix issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting without changes
npm run format:check

# TypeScript type checking (no emit)
npm run type-check
```

### Testing

```bash
# Run unit tests (Vitest)
npm test

# Watch mode for unit tests
npm test:watch

# Vitest UI
npm test:ui

# E2E tests (Playwright)
npm run e2e

# E2E tests with UI
npm run e2e:ui
```

## Environment Variables

Required variables (see `.env.local`):

```env
# Database
DATABASE_URL="file:./dev.db"

# Session
SESSION_SECRET="32+ character random string"

# App
APP_URL="http://localhost:3000"
NODE_ENV="development"

# Atlassian OAuth (from developer.atlassian.com)
ATLASSIAN_CLIENT_ID="your_client_id"
ATLASSIAN_CLIENT_SECRET="your_client_secret"
ATLASSIAN_REDIRECT_URI="http://localhost:3000/api/auth/atlassian/callback"

# Email (SMTP)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your_email@example.com"
SMTP_PASS="your_password"
EMAIL_FROM="noreply@example.com"
EMAIL_FROM_NAME="QA CaseForge"

# AI (Groq with Llama 3.1)
GROQ_API_KEY="gsk-..."
```

**Development email**: In dev mode, verification emails are logged to console instead of sent.

## Key Implementation Details

### CSRF Protection

All state-changing requests require CSRF tokens:
1. Client fetches token: `GET /api/auth/csrf-token`
2. Include in request body: `{ csrfToken: "...", ...data }`
3. Server validates via `lib/security/csrf.ts`

**Client helper**: `lib/client/csrf.ts` provides `withCsrf()` wrapper.

### Token Encryption

Jira tokens encrypted before database storage:
- Uses AES-256-GCM with random IV per token
- Master key from `SESSION_SECRET` environment variable
- See `lib/crypto/secrets.ts` for encryption utilities

### Test Case Storage Format

Test cases stored as JSON in database:
```typescript
{
  id: string;           // cuid
  suiteId: string;      // FK to TestSuite
  title: string;        // Test case name
  stepsJson: Json;      // Array of { action: string; expected: string }
  expected: string;     // Overall expected result
  priority: "P0"|"P1"|"P2"|"P3";
  type: "functional"|"negative"|"boundary"|"accessibility"|"security"|"performance";
  order: number;        // Display order in suite
}
```

### Jira Publishing Formats

**Test cases** → Published as subtasks:
- Task type: "Sub-task" or "Test" (if available)
- Description: Formatted as Atlassian Document Format (ADF)
- Parent link: Links to original user story

**Bugs** → Published as comments:
- Posted on parent story issue
- Contains severity, reproduction steps, and evidence links
- Uses ADF tables for structured presentation

### Exploration Pipeline

**Story-driven exploration** (v2):
1. Fetch story from Jira
2. Analyze story intent (explorability check)
3. Generate exploration plan with objectives
4. Validate plan quality
5. Execute exploration (currently mocked)
6. Detect bugs via AI analysis
7. Publish findings to Jira

**Key difference from v1**: V2 is story-aware and generates targeted objectives instead of generic exploration.

## Common Development Patterns

### Adding a New API Route

1. Create file: `app/api/your-route/route.ts`
2. Import session: `import { getCurrentSession } from "@/lib/auth/session"`
3. Validate CSRF for mutations: `import { validateCsrf } from "@/lib/security/csrf"`
4. Use Zod for validation: `import { z } from "zod"`
5. Handle errors: Return `NextResponse.json({ error: "..." }, { status: 4xx })`

### Creating a New Database Model

1. Update `prisma/schema.prisma`
2. Run: `npx prisma migrate dev --name add_your_model`
3. Import in code: `import { prisma } from "@/lib/db/prisma"`
4. Use TypeScript types: Prisma auto-generates types in `node_modules/.prisma/client`

### Adding a New shadcn/ui Component

```bash
# Install component
npx shadcn-ui@latest add component-name

# Component appears in components/ui/
```

### Extending Test Case Types

To add new test coverage type:
1. Update Prisma schema: `TestCase.type` enum
2. Migrate: `npx prisma migrate dev`
3. Update `lib/ai/generateCases.ts`: Add coverage instructions
4. Update UI: `components/generator/GenerationDialog.tsx` - Add checkbox option

## Testing Strategy

**Unit tests** (`lib/**/*.test.ts`):
- Crypto utilities (PKCE, token hashing)
- Validation schemas
- Pure utility functions

**Integration tests** (currently minimal):
- API routes with mocked database
- Jira API integration with recorded fixtures

**E2E tests** (`e2e/**/*.spec.ts`):
- Authentication flows
- Test generation workflow
- Jira publishing

**Coverage gaps** (future work):
- API route coverage is incomplete
- No browser automation tests for exploration
- Missing tests for error scenarios

## Security Considerations

1. **Never log tokens** - Tokens are redacted in logs via `lib/utils/safeStringify.ts`
2. **Encrypted storage** - All OAuth tokens encrypted at rest
3. **CSRF on mutations** - All POST/PUT/DELETE require CSRF tokens
4. **Input validation** - Zod schemas on all API inputs
5. **Session rotation** - Sessions expire after 7 days
6. **Rate limiting** - Email resend has 60-second cooldown (basic protection)

**Known limitations**:
- No global rate limiting on API routes (TODO)
- Token refresh could have race conditions under high concurrency (mitigated by token service locking)

## Known Issues & Quirks

1. **Email in dev mode**: Verification emails log to console, not sent via SMTP
2. **SQLite limitations**: Database uses SQLite for development; migrate to PostgreSQL for production
3. **Multi-site confusion**: Users with access to multiple Jira sites must select active site before API calls work
4. **Exploration v2 incomplete**: Browser automation is mocked; real Playwright integration pending
5. **No undo for publish**: Once test cases or bugs are published to Jira, they cannot be auto-deleted

## Future Architecture Considerations

### Migration to Production Database

Replace SQLite with PostgreSQL:
1. Update `prisma/schema.prisma`: `datasource db { provider = "postgresql" }`
2. Set `DATABASE_URL` to PostgreSQL connection string
3. Run migrations: `npx prisma migrate deploy`
4. Consider connection pooling (PgBouncer or Prisma Accelerate)

### Scaling Exploration

For real browser automation:
1. Integrate Playwright for headless browser control
2. Add job queue (BullMQ or similar) for async exploration runs
3. Store traces/screenshots in S3 or equivalent
4. Implement cleanup for ephemeral resources

### Auth Enhancements

Potential improvements:
1. OAuth providers (Google, GitHub) via NextAuth.js
2. 2FA/TOTP support
3. Session device tracking
4. Refresh token rotation for Jira tokens

## Debugging Tips

### Jira OAuth Issues

Check debug routes:
- `GET /api/jira/debug/connection` - Shows token status
- `GET /api/jira/debug/database` - Shows raw DB records
- `GET /api/jira/debug/search?q=SCRUM-1` - Tests search with current auth

### Database Issues

Use Prisma Studio for visual inspection:
```bash
npx prisma studio
# Opens http://localhost:5555
```

### Session Issues

Sessions stored in-memory during dev (mocked in `lib/db/mock.ts`). Restart server to clear all sessions.

### AI Generation Issues

If test generation fails:
1. Check `GROQ_API_KEY` is set correctly
2. Check API rate limits (Groq console: https://console.groq.com/)
3. Review request/response in server logs
4. Fallback to stub cases if API unavailable (automatic)

## Additional Resources

- **README.md**: User-facing setup instructions and feature overview
- **IMPLEMENTATION_SUMMARY.md**: Email verification implementation details
- **EMAIL_VERIFICATION_SETUP.md**: Email system configuration guide
- Jira REST API docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- Groq API docs: https://console.groq.com/docs/
- shadcn/ui docs: https://ui.shadcn.com/
