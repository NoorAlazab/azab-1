# End-to-end tests (Playwright + Page Object Model)

This suite drives a real browser against a running instance of the app.
It is organised as a strict Page Object Model so specs stay readable and
selectors stay in exactly one place.

```
tests/e2e/
├── pages/        ← Page Objects (one class per route)
│   ├── BasePage.ts     abstract root (goto/waitUntilReady helpers)
│   ├── LoginPage.ts
│   ├── SignupPage.ts
│   ├── DashboardPage.ts
│   ├── GeneratorPage.ts
│   ├── ExplorationPage.ts
│   ├── IntegrationsPage.ts
│   ├── SettingsPage.ts
│   └── index.ts        barrel re-export
├── fixtures/     ← shared fixtures and test data
│   ├── testUser.ts         canonical demo credentials
│   └── auth.fixture.ts     `test` with an `authedPage` fixture
├── specs/        ← actual *.spec.ts files
│   ├── public-pages.spec.ts
│   └── authed-smoke.spec.ts
└── README.md
```

## Running

### One-time setup

```bash
npm install
npx playwright install chromium     # ~150 MB browser download
```

If you skip the second step, Playwright will still discover and route to
the specs correctly but every run fails with
`browserType.launch: Executable doesn't exist ...`.

### Against a locally-running dev server

```bash
# terminal 1
npm run dev

# terminal 2
npx playwright test                    # all specs
npx playwright test --grep @smoke      # only smoke specs
npx playwright test public-pages       # a single file
```

The default base URL is `http://localhost:3000`. Override with:

```bash
TEST_BASE_URL=https://staging.example.com npx playwright test
```

### Credentials for authenticated specs

`fixtures/testUser.ts` points at a local demo user by default. In CI or
against a real env, export:

```bash
E2E_USER_EMAIL=you@example.com
E2E_USER_PASSWORD=********
```

## Writing new specs

1. **Add a Page Object** under `pages/` extending `BasePage`. Each page
   exposes:
   - `url`: the route it owns (e.g. `"/dashboard"`)
   - `readyLocator()`: a stable landmark proving the page has rendered
   - getter methods for interactive elements (return `Locator`, don't
     click/fill inside the getter)
   - optional high-level workflows (`login(email, password)`, `searchStory(jql)`)
2. **Export it from `pages/index.ts`** so specs can import from the barrel.
3. **Write the spec** under `specs/` using the Page Object:
   ```ts
   import { test, expect } from "../fixtures/auth.fixture";
   import { DashboardPage } from "../pages";

   test("dashboard shows checklist", async ({ authedPage }) => {
     const dashboard = new DashboardPage(authedPage);
     await dashboard.goto();
     await expect(dashboard.checklistSection()).toBeVisible();
   });
   ```

## Selector conventions (in order of preference)

1. `getByRole("button", { name: /save/i })`   — accessible-name queries
2. `getByLabel("Email")`                       — form fields
3. `getByText("Welcome back")`                 — user-visible copy
4. `getByTestId("jira-connection-status")`     — last resort, add a `data-testid` to the component

Raw CSS / XPath are prohibited: they break the moment the UI is refactored.
