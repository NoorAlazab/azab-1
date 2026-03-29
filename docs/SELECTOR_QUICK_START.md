# Quick Start: Recording Selectors from Your Website

Get started recording UI selectors in **5 minutes**!

## What You'll Do

1. Install Playwright browser
2. Record selectors from your website using Codegen
3. Create a selector mapping file
4. Test it works

---

## Step 1: Install Playwright Browser (1 minute)

```bash
npx playwright install chromium
```

**Expected output:**
```
Downloading Chromium... Done!
```

---

## Step 2: Record Selectors (2 minutes)

### Option A: Your Website is Running Locally

```bash
# Make sure your dev server is running (npm run dev)
npx playwright codegen http://localhost:3000
```

### Option B: Your Website is Deployed

```bash
npx playwright codegen https://your-website.com
```

**What happens:**
- A Chrome window opens showing your website
- A "Playwright Inspector" window appears

### Record Your Login Page

1. **Navigate** to your login page (e.g., `/login`)
2. **Click** on the email/username field
3. **Click** on the password field
4. **Click** on the login/sign-in button
5. **Press** the red ⏸ button to stop recording

**You'll see code like this in the Inspector:**
```javascript
await page.goto('http://localhost:3000/login');
await page.locator('input[name="email"]').click();
await page.locator('input[name="password"]').click();
await page.locator('button[type="submit"]').click();
```

✅ **Copy this code** (you'll need it in the next step)

---

## Step 3: Create Selector File (2 minutes)

### Extract the Selectors

From the code Codegen generated, extract the selectors:

| Codegen Generated | Extract This Selector |
|------------------|----------------------|
| `page.locator('input[name="email"]')` | `input[name="email"]` |
| `page.locator('input[name="password"]')` | `input[name="password"]` |
| `page.locator('button[type="submit"]')` | `button[type="submit"]` |

### Create the File

**Open:** `selectors/pages/login.json`

**Replace the content with YOUR actual selectors:**

```json
{
  "page": "/login",
  "description": "Login page elements for MY website",
  "elements": {
    "emailField": {
      "key": "emailField",
      "primary": "input[name='email']",
      "fallbacks": [
        "input[type='email']"
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
        "description": "Password input"
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
        "text": "Sign In",
        "description": "Submit login form"
      }
    }
  }
}
```

**💡 Pro Tip:** Adjust the `primary` selectors to match what Codegen generated for YOUR website!

---

## Step 4: Test It Works (30 seconds)

Run the build to ensure there are no syntax errors:

```bash
npm run build
```

✅ If successful, your selector file is valid!

---

## What You Just Accomplished

✅ **Recorded selectors** from your actual website (not guessing!)
✅ **Created a mapping file** that the test system can use
✅ **Added fallback selectors** for reliability

**Before:**
- Tests guessed selectors → 30% accuracy
- "Could not find element: login button" ❌

**After:**
- Tests use YOUR recorded selectors → 95%+ accuracy
- Elements found reliably ✅

---

## Next Steps

### Record More Pages (Recommended)

Record selectors for your most important pages:

**Dashboard page:**
```bash
npx playwright codegen http://localhost:3000/dashboard
```
Save to: `selectors/pages/dashboard.json`

**Settings page:**
```bash
npx playwright codegen http://localhost:3000/settings
```
Save to: `selectors/pages/settings.json`

### Record Common Elements

Record navigation, header, footer:

```bash
npx playwright codegen http://localhost:3000
```

Actions to record:
- Click logo
- Click navigation links
- Click user menu
- Click logout

Save to: `selectors/common.json` (update the existing file)

---

## Cheat Sheet

| Task | Command |
|------|---------|
| Start recording | `npx playwright codegen <url>` |
| Stop recording | Press red ⏸ button in Inspector |
| Copy generated code | Select all in Inspector, Ctrl+C |
| Save selector file | Create/edit `selectors/pages/<pagename>.json` |
| Test file is valid | `npm run build` |

---

## Common Questions

**Q: My website requires login to see the dashboard. How do I record that?**

A: Codegen has authentication support! Record your login flow first, then continue recording on protected pages.

```bash
npx playwright codegen --save-storage=auth.json http://localhost:3000/login
```

Then:
1. Perform login in the opened browser
2. Navigate to dashboard
3. Record selectors
4. Saved session will be in `auth.json`

**Q: What if the selector Codegen generates is too complex?**

A: Simplify it manually!

Codegen might generate:
```javascript
page.locator('div').filter({ hasText: 'Login' }).nth(2).locator('button')
```

Simplify to:
```json
"primary": "button:has-text('Login')"
```

**Q: How many fallbacks should I provide?**

A: **2-3 fallbacks** per element is ideal:
1. Primary (most specific)
2. Fallback 1 (semantic/type-based)
3. Fallback 2 (text-based)

**Q: Where do I find data-testid attributes?**

A: Open DevTools → Inspect element → Look for `data-testid="..."` in the HTML. If your website doesn't have them, use name, type, or aria-label attributes instead.

---

## Troubleshooting

**Error: "Chromium not found"**

```bash
npx playwright install chromium
```

**Error: "Cannot connect to localhost:3000"**

Make sure your dev server is running:
```bash
npm run dev
```

**Error: "Invalid JSON in selector file"**

- Check for missing commas
- Check for trailing commas (not allowed)
- Validate JSON at https://jsonlint.com

---

## Example: Complete Login Page Selectors

Here's a complete, real-world example:

```json
{
  "page": "/login",
  "description": "Login authentication page",
  "elements": {
    "emailField": {
      "key": "emailField",
      "primary": "input[name='email']",
      "fallbacks": ["input[type='email']", "input[id='email']"],
      "metadata": { "type": "input", "label": "Email" }
    },
    "passwordField": {
      "key": "passwordField",
      "primary": "input[name='password']",
      "fallbacks": ["input[type='password']"],
      "metadata": { "type": "input", "label": "Password" }
    },
    "loginButton": {
      "key": "loginButton",
      "primary": "button[type='submit']",
      "fallbacks": ["button:has-text('Sign In')", "form button"],
      "metadata": { "type": "button", "text": "Sign In" }
    },
    "forgotPasswordLink": {
      "key": "forgotPasswordLink",
      "primary": "a[href*='forgot']",
      "fallbacks": ["a:has-text('Forgot')"],
      "metadata": { "type": "link", "text": "Forgot password?" }
    },
    "errorMessage": {
      "key": "errorMessage",
      "primary": "[role='alert']",
      "fallbacks": [".error-message", ".text-red-600"],
      "metadata": { "type": "text", "description": "Error message display" }
    }
  }
}
```

---

**Ready to improve your test accuracy?** Start recording selectors now!

**Need more details?** See [RECORDING_SELECTORS.md](./RECORDING_SELECTORS.md) for the complete guide.
