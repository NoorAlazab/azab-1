# QA CaseForge

A modern React application for generating AI-powered test cases from Jira user stories. Built with Next.js 14, TypeScript, Tailwind CSS, and integrated with Atlassian Jira via OAuth 2.0 PKCE flow.

## Features

- **Passwordless Authentication**: Magic link login system
- **Jira Integration**: Secure OAuth 2.0 connection with PKCE
- **Modern UI**: Clean, responsive interface built with shadcn/ui
- **Type-Safe**: Full TypeScript coverage with strict mode
- **Secure**: HTTP-only cookies, CSRF protection, input validation
- **Production-Ready**: Comprehensive testing and error handling

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Query (TanStack)
- **Authentication**: Magic links + Atlassian OAuth 2.0 PKCE
- **Validation**: Zod schemas
- **Testing**: Vitest (unit) + Playwright (e2e)
- **Linting**: ESLint + Prettier

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Atlassian Developer Account

### 1. Clone and Install

```bash
git clone <repository-url>
cd qa-caseforge
pnpm install
```

### 2. Environment Setup

1. Copy the environment template:
```bash
cp .env.example .env.local
```

2. Fill in the required values:

```env
# Get these from https://developer.atlassian.com/console/myapps/
ATLASSIAN_CLIENT_ID=your_client_id
ATLASSIAN_CLIENT_SECRET=your_client_secret
ATLASSIAN_REDIRECT_URI=http://localhost:3000/api/auth/atlassian/callback

# Generate a secure random string (32+ characters)
SESSION_SECRET=your_secure_random_string_here

# App base URL
APP_URL=http://localhost:3000

NODE_ENV=development
```

### 3. Atlassian App Setup

1. Go to [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/)
2. Create a new OAuth 2.0 (3LO) app
3. Configure these settings:
   - **Redirect URLs**: `http://localhost:3000/api/auth/atlassian/callback`
   - **Scopes**: `read:jira-work`, `write:jira-work`, `read:me`, `offline_access`
4. Copy the Client ID and Client Secret to your `.env.local`

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Magic Link Authentication (Development)

1. Go to `/login`
2. Enter your email address
3. Check the terminal/console for the magic link URL
4. Copy and paste the URL into your browser to complete login

### Jira Connection

1. After logging in, click "Connect Jira"
2. You'll be redirected to Atlassian for OAuth consent
3. Grant the requested permissions
4. You'll be redirected back to the dashboard

## Development

### Project Structure

```
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Dashboard pages  
│   ├── api/               # API routes
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── auth/             # Authentication components
│   └── ui/               # shadcn/ui components
├── lib/                  # Utility libraries
│   ├── auth/            # Authentication helpers
│   ├── db/              # Database (mock)
│   └── oauth/           # OAuth integration
├── types/               # TypeScript definitions
├── test/               # Unit tests
└── e2e/               # End-to-end tests
```

### Available Scripts

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Code Quality  
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint errors
pnpm format           # Format with Prettier
pnpm format:check     # Check formatting
pnpm type-check       # TypeScript checking

# Testing
pnpm test             # Run unit tests
pnpm test:watch       # Run tests in watch mode
pnpm test:ui          # Run tests with UI
pnpm e2e              # Run e2e tests
pnpm e2e:ui           # Run e2e tests with UI
```

### Magic Link Development

In development mode, magic links are logged to the console instead of being sent via email:

```
=====================================
🔗 MAGIC LINK EMAIL (DEV MODE)
=====================================
To: user@example.com
Link: http://localhost:3000/api/auth/magic-link/callback?token=abc123...
=====================================
```

Copy the link and paste it into your browser to log in.

## Security Features

- **Session Management**: HTTP-only, signed cookies with rotation
- **CSRF Protection**: Token verification for state-changing operations
- **Input Validation**: Zod schemas for all API inputs
- **Token Storage**: Encrypted storage of OAuth tokens
- **PKCE Flow**: Secure OAuth 2.0 implementation
- **Rate Limiting**: Basic protection against abuse (TODO: enhance)

## API Endpoints

### Authentication
- `GET /api/auth/session` - Get current session
- `POST /api/auth/magic-link/start` - Send magic link
- `GET /api/auth/magic-link/callback` - Magic link callback

### Atlassian OAuth
- `POST /api/auth/atlassian/start` - Start OAuth flow
- `GET /api/auth/atlassian/callback` - OAuth callback
- `POST /api/auth/atlassian/disconnect` - Disconnect Jira

### Jira Integration  
- `GET /api/jira/me` - Get user profile and site info

## Testing

### Unit Tests

Run unit tests with Vitest:

```bash
pnpm test
```

Tests cover:
- Crypto utilities (PKCE, encoding)
- Session management
- Authentication flows
- API validation schemas

### End-to-End Tests

Run e2e tests with Playwright:

```bash
pnpm e2e
```

Tests cover:
- Login flow (magic link)
- OAuth flow (mocked)
- Dashboard functionality
- Error handling

## Future Roadmap

The current implementation focuses on authentication and Jira connection. Planned features:

1. **Issue Picker**: Browse and select Jira user stories
2. **LLM Integration**: AI-powered test case generation
3. **Test Case Editor**: Rich editor for generated test cases
4. **Jira Write-back**: Save generated test cases back to Jira
5. **Batch Processing**: Generate test cases for multiple stories
6. **Templates**: Customizable test case templates
7. **Export Options**: PDF, CSV, and other formats

## Architecture Notes

### Authentication System

- **Magic Links**: Passwordless authentication using time-limited tokens
- **Session Management**: Secure cookie-based sessions with CSRF protection  
- **OAuth Integration**: Standards-compliant PKCE flow for Atlassian

### Storage Layer

Currently uses in-memory storage for development. The interfaces are designed for easy migration to:

- **PostgreSQL**: Recommended for production
- **Redis**: For session storage and caching
- **External Auth**: Auth0, Supabase, etc.

### Security Considerations

- All secrets are server-side only
- Tokens are encrypted before storage
- CSRF tokens prevent cross-site attacks
- Input validation on all endpoints
- Secure cookie configuration

### Exploration — Ephemeral Users

The Exploration module provides automated browser testing with ephemeral user provisioning:

#### How It Works

1. **User Selection**: Choose from predefined roles (recruiter, hiring_manager, admin)
2. **Ephemeral Provisioning**: Server creates temporary user account with appropriate permissions
3. **Login Capture**: Automated login process captures browser storage state (cookies, localStorage)
4. **Exploration Execution**: AI-driven browser automation using captured authentication
5. **Cleanup**: Ephemeral users and storage states are cleaned up after exploration

#### Current Implementation (Mocked)

- **User Provisioning**: Mocked user creation with realistic email/role assignment
- **Login Automation**: Simulated browser login with storage state capture
- **Role-Based Testing**: Different permission levels for comprehensive coverage

#### Production Integration Points

Ready for integration with:

- **ATS APIs**: Real user provisioning through target application APIs
- **Playwright**: Actual browser automation for login capture
- **Storage Management**: Secure storage state persistence and rotation

#### Cleanup Guarantees

- Ephemeral users are tied to exploration runs
- Storage states expire automatically
- Background cleanup processes remove stale accounts
- Rate limiting prevents resource abuse

#### Known Limitations

- Currently mocked for development/demo purposes
- Real ATS integration requires custom adapters per target system
- Browser automation depends on target application login flows

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

1. Check the [Issues](../../issues) page
2. Review the [Discussions](../../discussions) 
3. Consult the [Atlassian OAuth documentation](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)

---

Built with ❤️ using Next.js and TypeScript