/**
 * Test script to diagnose journey-based page discovery
 * Run with: node test-journey-discovery.js
 */

const { chromium } = require('playwright');

async function testDiscovery() {
  console.log('🔍 Starting journey discovery test...\n');

  // CONFIGURE THESE:
  const environmentUrl = 'YOUR_ENVIRONMENT_URL_HERE'; // e.g., 'http://localhost:3000'
  const username = 'YOUR_USERNAME_HERE';
  const password = 'YOUR_PASSWORD_HERE';
  const keywords = ['users', 'dashboard', 'settings']; // Keywords to search for

  console.log(`Environment: ${environmentUrl}`);
  console.log(`Keywords: ${keywords.join(', ')}\n`);

  const browser = await chromium.launch({ headless: false }); // Set headless: true to hide browser
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  try {
    // Step 1: Navigate to environment
    console.log(`📡 Navigating to ${environmentUrl}...`);
    await page.goto(environmentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`✅ Page loaded: ${page.url()}\n`);

    // Step 2: Try to login
    console.log('🔐 Attempting login...');

    // Find email field
    const emailSelectors = [
      'input[type="email"]',
      'input[name*="email" i]',
      'input[name*="username" i]',
      'input[id*="email" i]',
    ];

    let emailField = null;
    for (const selector of emailSelectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) {
        emailField = locator;
        console.log(`  Found email field: ${selector}`);
        break;
      }
    }

    if (!emailField) {
      console.log('❌ Could not find email/username field');
      console.log('   The page might not be a login page, or selectors need adjustment\n');
    } else {
      await emailField.fill(username);
      console.log(`  ✅ Filled username\n`);

      // Find password field
      const passwordField = page.locator('input[type="password"]').first();
      if (await passwordField.isVisible().catch(() => false)) {
        await passwordField.fill(password);
        console.log(`  ✅ Filled password\n`);

        // Find submit button
        const submitButton = page.locator('button[type="submit"]').first();
        if (await submitButton.isVisible().catch(() => false)) {
          await submitButton.click();
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(2000);
          console.log(`  ✅ Logged in! Current URL: ${page.url()}\n`);
        }
      }
    }

    // Step 3: Scan navigation
    console.log('🔍 Scanning navigation menu...');
    const navigationItems = await page.evaluate(() => {
      const items = [];
      const navSelectors = [
        'nav a',
        '[role="navigation"] a',
        'header a',
        'aside a',
        '[class*="menu"] a',
        '[class*="nav"] a',
        '[class*="sidebar"] a',
      ];

      const processedHrefs = new Set();

      for (const selector of navSelectors) {
        const links = document.querySelectorAll(selector);
        for (const link of links) {
          const href = link.getAttribute('href');
          const text = link.textContent?.trim() || '';

          if (!href || !text || processedHrefs.has(href)) continue;

          try {
            const url = new URL(href, window.location.href);
            if (url.origin !== window.location.origin) continue;
          } catch {
            continue;
          }

          items.push({ text, href });
          processedHrefs.add(href);
        }
      }

      return items;
    });

    console.log(`  ✅ Found ${navigationItems.length} navigation items:\n`);
    navigationItems.slice(0, 20).forEach(item => {
      console.log(`     • "${item.text}" → ${item.href}`);
    });
    console.log();

    // Step 4: Try to match keywords
    console.log('🎯 Matching keywords to navigation...\n');
    for (const keyword of keywords) {
      const matches = navigationItems.filter(item =>
        item.text.toLowerCase().includes(keyword.toLowerCase()) ||
        item.href.toLowerCase().includes(keyword.toLowerCase())
      );

      if (matches.length > 0) {
        console.log(`  ✅ "${keyword}" matched:`);
        matches.forEach(m => console.log(`     → "${m.text}" (${m.href})`));
      } else {
        console.log(`  ❌ "${keyword}" - no match found`);
      }
      console.log();
    }

    console.log('\n✨ Discovery test complete!');
    console.log('\nDiagnostic Tips:');
    console.log('• If no navigation items found: Page might not have loaded properly after login');
    console.log('• If keywords don\'t match: Use the actual text from navigation items above');
    console.log('• Check the server logs for detailed discovery logs when running actual tests');

  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
  } finally {
    await page.waitForTimeout(3000); // Keep browser open for 3 seconds
    await browser.close();
  }
}

testDiscovery().catch(console.error);
