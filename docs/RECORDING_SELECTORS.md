# Recording UI Selectors Guide

This guide shows you how to record reliable selectors from your website using Playwright Codegen and convert them into selector mapping files.

## Table of Contents

1. [Why Record Selectors?](#why-record-selectors)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Method 1: Using Playwright Codegen (Recommended)](#method-1-using-playwright-codegen-recommended)
5. [Method 2: Manual Extraction via DevTools](#method-2-manual-extraction-via-devtools)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Why Record Selectors?

Instead of having tests **guess** which button is the "login button", we **record** the exact selector beforehand. This improves test accuracy from ~30% to ~95%+.

**Before (guessing):**
```
❌ "Click the login button" → tries: button:has-text("the login button")
❌ No element found → test fails
```

**After (recorded):**
```
✅ "Click `loginButton`" → uses: button[data-testid="login-submit"]
✅ Element found → test passes
```

---

## Prerequisites

1. **Playwright installed** (already done via package.json)
   ```bash
   npm install  # If not done already
   ```

2. **Chromium browser installed**
   ```bash
   npx playwright install chromium
   ```

3. **Access to your website** (running locally or on a server)

---

## Quick Start

**Record selectors in 3 steps:**

```bash
# 1. Start Playwright Codegen
npx playwright codegen https://your-website.com

# 2. Interact with your website (it records everything)
# - Click buttons, fill forms, navigate pages

# 3. Copy the generated code and convert to JSON
# (See detailed steps below)
```

---

## Method 1: Using Playwright Codegen (Recommended)

### Step 1: Launch Codegen

```bash
# For local development
npx playwright codegen http://localhost:3000

# For deployed site
npx playwright codegen https://your-website.com

# With specific viewport size
npx playwright codegen --viewport-size=1280,720 https://your-website.com

# With specific browser
npx playwright codegen --browser=chromium https://your-website.com
```

**What happens:**
- A browser window opens showing your website
- A "Playwright Inspector" window appears with recording tools

### Step 2: Record Your Flow

**Example: Recording Login Page**

1. Navigate to `/login` page
2. **Click** on the email field → Codegen records: `page.locator('input[name="email"]').click()`
3. **Click** on the password field
4. **Click** on the "Sign In" button
5. **Stop recording** (red button in Inspector)

**What you'll see in the Inspector:**
```javascript
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.locator('input[name="email"]').click();
  await page.locator('input[name="password"]').click();
  await page.locator('button[type="submit"]').click();
});
```

### Step 3: Extract Selectors

From the generated code, extract the selectors:

| Action | Generated Code | Selector to Extract |
|--------|----------------|---------------------|
| Email field | `page.locator('input[name="email"]')` | `input[name="email"]` |
| Password field | `page.locator('input[name="password"]')` | `input[name="password"]` |
| Login button | `page.locator('button[type="submit"]')` | `button[type="submit"]` |

### Step 4: Create Selector Mapping File

Create `selectors/pages/login.json`:

```json
{
  "page": "/login",
  "description": "Login page elements",
  "elements": {
    "emailField": {
      "key": "emailField",
      "primary": "input[name='email']",
      "fallbacks": [
        "input[type='email']",
        "input[placeholder*='email' i]"
      ],
      "metadata": {
        "type": "input",
        "description": "Email input field"
      }
    },
    "passwordField": {
      "key": "passwordField",
      "primary": "input[name='password']",
      "fallbacks": [
        "input[type='password']"
      ],
      "metadata": {
        "type": "input",
        "description": "Password input field"
      }
    },
    "loginButton": {
      "key": "loginButton",
      "primary": "button[type='submit']",
      "fallbacks": [
        "button:has-text('Sign In')",
        "button:has-text('Login')"
      ],
      "metadata": {
        "type": "button",
        "text": "Sign In"
      }
    }
  }
}
```

### Step 5: Add Fallback Selectors

For each selector, add 2-3 fallbacks in case the primary selector breaks:

**Good fallback progression:**
1. **Primary**: Most specific (data-testid, unique ID, name attribute)
2. **Fallback 1**: Semantic (type, aria-label)
3. **Fallback 2**: Text-based (has-text, visible text)

**Example:**
```json
{
  "loginButton": {
    "primary": "button[data-testid='login-submit']",  // Best - intentional test ID
    "fallbacks": [
      "button[type='submit']",                        // Good - semantic
      "button:has-text('Sign In')",                   // OK - text-based
      "form button"                                   // Weak - structural
    ]
  }
}
```

---

## Method 2: Manual Extraction via DevTools

If you prefer manual extraction or need to inspect specific elements:

### Step 1: Open DevTools

1. Right-click on the element → **Inspect**
2. DevTools opens with the element highlighted

### Step 2: Find the Best Selector

**Priority order:**

1. **data-testid attribute** (best)
   ```html
   <button data-testid="login-submit">Sign In</button>
   ```
   Selector: `button[data-testid='login-submit']`

2. **Unique ID**
   ```html
   <input id="email" type="email" />
   ```
   Selector: `#email` or `input[id='email']`

3. **Name attribute**
   ```html
   <input name="password" type="password" />
   ```
   Selector: `input[name='password']`

4. **Type + context**
   ```html
   <button type="submit">Sign In</button>
   ```
   Selector: `button[type='submit']`

5. **ARIA labels**
   ```html
   <button aria-label="Submit login form">Sign In</button>
   ```
   Selector: `button[aria-label='Submit login form']`

6. **Text content** (last resort)
   ```html
   <button>Sign In</button>
   ```
   Selector: `button:has-text('Sign In')`

### Step 3: Test Selector in DevTools Console

```javascript
// In DevTools Console, test your selector:
document.querySelector('button[type="submit"]')

// Should return the element (not null)
```

### Step 4: Add to Selector File

Add the selector to your JSON file as shown in Method 1.

---

## Best Practices

### 1. Use Descriptive Element Keys

```json
// ✅ Good
"loginButton", "emailField", "submitFormButton"

// ❌ Bad
"btn1", "input2", "element"
```

### 2. Always Provide Fallbacks

```json
{
  "emailField": {
    "primary": "input[name='email']",
    "fallbacks": [
      "input[type='email']",           // Fallback 1
      "input[placeholder*='email' i]"  // Fallback 2
    ]
  }
}
```

### 3. Prefer Stable Selectors

**Stable (won't break easily):**
- `[data-testid='login']` ✅
- `#username` ✅
- `input[type='email']` ✅
- `button[aria-label='Submit']` ✅

**Fragile (breaks often):**
- `.css-abc123` ❌ (generated classes)
- `div > div > button` ❌ (structural)
- `.btn.btn-primary.btn-lg` ❌ (multiple classes)

### 4. Add Complete Metadata

```json
{
  "loginButton": {
    "key": "loginButton",
    "primary": "button[type='submit']",
    "fallbacks": ["button:has-text('Sign In')"],
    "metadata": {
      "type": "button",
      "text": "Sign In",
      "label": "Submit login form",
      "description": "Primary submit button for login",
      "lastVerified": "2024-10-26T00:00:00Z"
    }
  }
}
```

### 5. Group Related Elements

**One file per page/feature:**
```
selectors/pages/
├── login.json          # Login page only
├── dashboard.json      # Dashboard only
├── settings.json       # Settings page only
└── checkout.json       # Checkout flow
```

### 6. Use Context for Ambiguous Elements

When multiple similar elements exist:

```json
{
  "checkoutSubmitButton": {
    "primary": "button[type='submit']",
    "fallbacks": ["button:has-text('Place Order')"],
    "context": {
      "insideContainer": "form.checkout-form",
      "nearElement": "input[name='credit-card']"
    }
  }
}
```

---

## Recording Common Flows

### Recording a Complete Login Flow

```bash
npx playwright codegen http://localhost:3000/login
```

**Actions to record:**
1. Click email field
2. Click password field
3. Click "Remember me" checkbox (if exists)
4. Click "Sign In" button
5. Click "Forgot password?" link
6. Click "Sign up" link

**Result:** Selectors for all login page elements

### Recording Navigation Flow

```bash
npx playwright codegen http://localhost:3000
```

**Actions to record:**
1. Click logo
2. Click each navigation link (Dashboard, Generator, Exploration, Settings)
3. Click user menu
4. Click logout

**Result:** Selectors for common navigation elements → save to `selectors/common.json`

### Recording a Form

```bash
npx playwright codegen http://localhost:3000/settings
```

**Actions to record:**
1. Click each input field
2. Click each dropdown/select
3. Click each checkbox/radio button
4. Click submit button
5. Click cancel button

---

## Troubleshooting

### Problem: Codegen generates complex selectors

**Example:**
```javascript
page.locator('div').filter({ hasText: 'Sign In' }).nth(2).locator('button')
```

**Solution:** Simplify manually
```json
{
  "primary": "button:has-text('Sign In')",
  "fallbacks": ["form button[type='submit']"]
}
```

### Problem: Selector works in Codegen but not in tests

**Possible causes:**
1. Element loads dynamically → Add wait
2. Element is in shadow DOM → Use special selectors
3. Element is in iframe → Access iframe first

**Solution:** Add context or use more specific selector

### Problem: Multiple elements match selector

**Example:**
```
Found 3 elements matching 'button[type="submit"]'
```

**Solution:** Add context
```json
{
  "context": {
    "insideContainer": "form.login-form",
    "index": 0
  }
}
```

### Problem: Selector breaks after UI update

**This is why we have fallbacks!**

The system automatically tries fallbacks in order:
1. Primary fails → Try fallback-0
2. Fallback-0 fails → Try fallback-1
3. Fallback-1 works → Test passes ✅

**Action:** Update the primary selector when possible, keep fallbacks as safety net

---

## Validating Your Selectors

After creating selector files, validate them:

```bash
# Check if selectors are properly formatted
npm run validate-selectors

# Test selectors against live website
npm run check-selectors -- https://your-website.com
```

---

## Next Steps

After recording selectors:

1. ✅ **Create selector files** for your critical pages (login, dashboard, main flows)
2. ✅ **Test the selectors** using exploration testing
3. ✅ **Monitor health** using the health checker script
4. ✅ **Update as needed** when UI changes

---

## Quick Reference

| Task | Command |
|------|---------|
| Record selectors | `npx playwright codegen <url>` |
| Validate selector files | `npm run validate-selectors` |
| Check selector health | `npm run check-selectors -- <url>` |
| View all mappings | Check `selectors/` directory |

---

## Examples

See these files for complete examples:
- `selectors/common.json` - Shared navigation elements
- `selectors/pages/login.json` - Login page elements
- `selectors/pages/dashboard.json` - Dashboard elements

---

**Need help?** Check the main documentation or create an issue in the repository.
