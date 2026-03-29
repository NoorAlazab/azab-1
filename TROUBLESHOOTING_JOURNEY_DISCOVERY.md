# Troubleshooting Journey-Based Discovery

## ✅ Fixes Applied

### 1. **Fixed: Empty Keywords Issue**
**Problem:** When no pages were provided in the request, the system tried to discover with 0 keywords, resulting in "0 pages recorded".

**Fix:** Added automatic fallback keywords (`['dashboard', 'home', 'users', 'settings', 'profile', 'admin']`) when no pages are specified.

**File:** [app/api/exploration-v2/record-selectors/route.ts](app/api/exploration-v2/record-selectors/route.ts#L92-L100)

### 2. **Enhanced Logging**
Added detailed logging throughout the discovery process to help diagnose issues.

**Check your server logs for:**
- `"Using journey-based selector recording"` - Confirms journey mode is active
- `"Navigation scan complete"` - Shows how many nav items were found
- `"Found navigation match"` - Shows keyword matching success
- `"Page discovery complete"` - Shows final count of discovered journeys

---

## 🔍 Diagnostic Steps

### Step 1: Run the Test Script

I created a diagnostic script to test discovery independently:

```bash
# 1. Edit the script and configure your environment
notepad test-journey-discovery.js

# 2. Set these variables at the top:
#    - environmentUrl (your test environment URL)
#    - username (login credentials)
#    - password (login credentials)
#    - keywords (pages you want to find)

# 3. Run the script
node test-journey-discovery.js
```

This will show you:
- ✅ If login is working
- ✅ How many navigation items are found
- ✅ What keywords match which navigation items
- ❌ Where the process is failing

---

### Step 2: Check Server Logs

When you run selector recording, check your terminal where `npm run dev` is running. You should see logs like:

```
✅ GOOD LOGS (working):
┌ Using journey-based selector recording
├ Starting journey-based selector recording
├ Navigation scan complete - itemsFound: 15
├ Found navigation match - keyword: "users", matchedText: "Team Members"
├ Navigation successful - pageKeyword: "users", finalUrl: "/admin/team"
└ Journey-based recording complete - journeysCount: 3

❌ BAD LOGS (problems):
└ No navigation items found - page might not have loaded properly
  → Check if your environment URL is accessible
  → Check if login credentials are correct
  → Check if you're being redirected somewhere unexpected
```

---

### Step 3: Common Issues & Solutions

#### Issue: "No navigation items found"

**Causes:**
1. **Page didn't load** - Environment URL is wrong or server is down
2. **Login failed** - Credentials are incorrect or login flow is different
3. **Redirected away** - After login, you're sent to a page without navigation

**Solutions:**
- Verify your environment URL is accessible
- Test login manually in a browser
- Check what URL you land on after login (should have navigation menu)

---

#### Issue: Keywords don't match

**Causes:**
- Navigation text doesn't contain your keywords
- Example: You search for "users" but menu says "Team Members"

**Solutions:**
- Run the diagnostic script to see actual navigation text
- Use keywords that match your actual navigation:
  ```javascript
  // Instead of:
  pages: ['users']

  // Use:
  pages: ['team', 'members']
  ```

**The system has semantic matching for common terms:**
- `users` matches: user, users, people, members, team, accounts
- `settings` matches: setting, settings, preferences, configuration, config
- `dashboard` matches: dashboard, home, overview, main

---

#### Issue: "Successfully recorded 0 pages"

**This happens when:**
1. ✅ **FIXED:** No keywords were provided (now uses defaults)
2. Login fails silently
3. Navigation menu isn't visible on the landing page
4. All keywords fail to match

**Debug by:**
1. Run `test-journey-discovery.js` to see what's happening
2. Check server logs for specific error messages
3. Manually test the login flow in a browser

---

### Step 4: API Request Format

Make sure you're calling the API correctly:

```javascript
POST /api/exploration-v2/record-selectors
Content-Type: application/json

{
  "environment": "http://localhost:3000",  // Your environment URL
  "username": "test@example.com",           // Login credentials
  "password": "password123",                // Login credentials
  "pages": ["users", "settings"],           // Keywords to find (optional now)
  "storyKey": "SCRUM-123",                  // Jira story key
  "saveCredentials": true                   // Save for future use
}
```

**Journey mode activates when:**
- ✅ `username` AND `password` are provided
- ✅ `storyKey` is provided
- ✅ Then it will use journey-based discovery

**If `pages` is empty:**
- System now uses default keywords: `['dashboard', 'home', 'users', 'settings', 'profile', 'admin']`
- It will try to match these against your navigation

---

### Step 5: Check Journey Storage

After successful recording, journeys are stored here:

```
journeys/
└── environments/
    └── {environment-slug}/
        └── sitemap.json
```

Check this file to see:
- What journeys were discovered
- What URLs they mapped to
- What navigation steps were recorded

Example:
```json
{
  "environmentUrl": "http://localhost:3000",
  "environmentSlug": "localhost-3000",
  "pages": [
    {
      "pageKeyword": "users",
      "actualUrl": "http://localhost:3000/admin/team",
      "navigationItemText": "Team Members",
      "steps": [
        {
          "action": "click",
          "target": "Team Members",
          "targetSelector": "a.nav-link[href=\"/admin/team\"]",
          "description": "Click 'Team Members' in navigation menu"
        }
      ]
    }
  ]
}
```

---

## 🆘 Still Having Issues?

### Enable Verbose Logging

The system already logs to console. Check your Next.js dev server terminal.

### Common Gotchas

1. **Port Conflicts:** Make sure your test environment is running on the expected port
2. **CORS Issues:** If testing against external environment, CORS might block requests
3. **SSO/OAuth Login:** System only supports standard username/password login
4. **Multi-Step Login:** If login requires 2FA or captcha, it won't work
5. **SPA Routing:** If your app is a SPA with client-side routing, navigation scanning should still work

### What to Report

If you still get "0 pages recorded", provide:
1. **Server logs** from the terminal (copy the full output)
2. **Output from** `test-journey-discovery.js`
3. **Your navigation structure** (what menu items actually exist)
4. **Keywords you're trying** to match

---

## 📊 Expected Behavior

**When working correctly, you should see:**

```
✅ API Response:
{
  "success": true,
  "environmentSlug": "localhost-3000",
  "recordedPages": [
    {
      "page": "users",
      "elementsRecorded": 15,
      "filePath": "selectors/environments/localhost-3000/users.json",
      "success": true
    },
    {
      "page": "settings",
      "elementsRecorded": 12,
      "filePath": "selectors/environments/localhost-3000/settings.json",
      "success": true
    }
  ],
  "totalElements": 27,
  "journeys": [
    { "pageKeyword": "users", "actualUrl": "/admin/team", ... },
    { "pageKeyword": "settings", "actualUrl": "/preferences", ... }
  ]
}
```

**Server logs:**
```
Using journey-based selector recording
Starting journey-based selector recording
Attempting login with journey recording
Login completed successfully
Navigation scan complete - itemsFound: 18
Found navigation match - keyword: "users", matchedText: "Team Members", score: 50
Building journey to page - pageKeyword: "users"
Navigation successful - finalUrl: /admin/team
Recorded selectors for discovered page - elementCount: 15
Journey-based recording complete - totalJourneys: 2
```

---

## 🎯 Next Steps

1. **Run the diagnostic script** to verify your setup
2. **Check the logs** when making actual API requests
3. **Verify journey files** are created in `journeys/environments/`
4. **Test with actual keywords** from your navigation menu

The system is now much more robust and should work with most applications!
