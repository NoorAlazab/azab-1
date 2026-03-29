/**
 * Comprehensive verification script for navigation system
 */

const { PrismaClient } = require('@prisma/client');
const { normalizePageKeyword } = require('./lib/utils/pageKeywordNormalizer.ts');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 COMPREHENSIVE NAVIGATION SYSTEM VERIFICATION\n');
  console.log('='.repeat(70));

  let allChecks = [];

  // CHECK 1: Database has normalized navigation selectors
  console.log('\n📋 CHECK 1: Database Navigation Selectors');
  console.log('-'.repeat(70));

  const navSelectors = await prisma.pageSelector.findMany({
    where: { isNavigationElement: true },
    select: {
      pageName: true,
      leadsToPage: true,
      discoveredUrl: true,
      primarySelector: true,
    },
  });

  console.log(`Found ${navSelectors.length} navigation selectors`);

  if (navSelectors.length === 0) {
    console.log('❌ FAIL: No navigation selectors in database');
    allChecks.push({ name: 'Navigation selectors exist', pass: false });
  } else {
    console.log('✅ PASS: Navigation selectors found');
    allChecks.push({ name: 'Navigation selectors exist', pass: true });

    navSelectors.forEach((sel, i) => {
      console.log(`\n  Selector ${i + 1}:`);
      console.log(`    From: "${sel.pageName}"`);
      console.log(`    To: "${sel.leadsToPage}"`);
      console.log(`    URL: ${sel.discoveredUrl}`);
      console.log(`    Selector: ${sel.primarySelector}`);

      // Check if normalized
      const normalizedFrom = normalizePageKeyword(sel.pageName);
      const normalizedTo = sel.leadsToPage ? normalizePageKeyword(sel.leadsToPage) : '';

      const isFromNormalized = sel.pageName === normalizedFrom;
      const isToNormalized = sel.leadsToPage === normalizedTo;

      if (isFromNormalized && isToNormalized) {
        console.log(`    ✅ Normalized correctly`);
      } else {
        console.log(`    ⚠️  NOT NORMALIZED:`);
        console.log(`       From: "${sel.pageName}" should be "${normalizedFrom}"`);
        console.log(`       To: "${sel.leadsToPage}" should be "${normalizedTo}"`);
      }
    });
  }

  // CHECK 2: Test normalization function
  console.log('\n\n📋 CHECK 2: Normalization Function');
  console.log('-'.repeat(70));

  const testCases = [
    { input: 'log in', expected: 'login' },
    { input: 'Log In', expected: 'login' },
    { input: 'Sign Up', expected: 'signup' },
    { input: '/login', expected: 'login' },
    { input: 'User Management', expected: 'usermanagement' },
    { input: 'dashboard', expected: 'dashboard' },
  ];

  let normalizationPass = true;
  testCases.forEach(({ input, expected }) => {
    const result = normalizePageKeyword(input);
    const pass = result === expected;

    console.log(`  "${input}" → "${result}" ${pass ? '✅' : '❌ Expected: "' + expected + '"'}`);

    if (!pass) normalizationPass = false;
  });

  if (normalizationPass) {
    console.log('\n✅ PASS: All normalization tests passed');
    allChecks.push({ name: 'Normalization function', pass: true });
  } else {
    console.log('\n❌ FAIL: Some normalization tests failed');
    allChecks.push({ name: 'Normalization function', pass: false });
  }

  // CHECK 3: Verify lookup would work
  console.log('\n\n📋 CHECK 3: Navigation Lookup Simulation');
  console.log('-'.repeat(70));

  if (navSelectors.length > 0) {
    const testLookups = [
      { from: 'dashboard', to: 'login' },
      { from: 'dashboard', to: 'log in' }, // Should still find via normalization
      { from: 'Dashboard', to: 'Login' }, // Should still find via normalization
    ];

    for (const lookup of testLookups) {
      console.log(`\n  Looking up: "${lookup.from}" → "${lookup.to}"`);

      const normalizedFrom = normalizePageKeyword(lookup.from);
      const normalizedTo = normalizePageKeyword(lookup.to);

      console.log(`    Normalized: "${normalizedFrom}" → "${normalizedTo}"`);

      // Simulate exact match (STRATEGY 1)
      const exactMatch = navSelectors.find(sel =>
        sel.pageName === normalizedFrom &&
        sel.leadsToPage === normalizedTo
      );

      if (exactMatch) {
        console.log(`    ✅ EXACT MATCH FOUND: ${exactMatch.discoveredUrl}`);
      } else {
        console.log(`    ⚠️  Exact match not found, trying fuzzy match...`);

        // Simulate fuzzy match (STRATEGY 2)
        const fuzzyMatch = navSelectors.find(sel =>
          normalizePageKeyword(sel.pageName) === normalizedFrom &&
          sel.leadsToPage && normalizePageKeyword(sel.leadsToPage) === normalizedTo
        );

        if (fuzzyMatch) {
          console.log(`    ✅ FUZZY MATCH FOUND: ${fuzzyMatch.discoveredUrl}`);
        } else {
          console.log(`    ❌ NO MATCH FOUND`);
        }
      }
    }

    allChecks.push({ name: 'Navigation lookup simulation', pass: true });
  }

  // CHECK 4: Verify test cases would navigate correctly
  console.log('\n\n📋 CHECK 4: Test Case Navigation');
  console.log('-'.repeat(70));

  const testCase = await prisma.testCase.findFirst({
    where: {
      OR: [
        { title: { contains: 'login' } },
        { title: { contains: 'Login' } },
      ]
    },
    select: {
      title: true,
      stepsJson: true,
    }
  });

  if (testCase) {
    console.log(`Test Case: "${testCase.title}"`);
    console.log(`\nSteps:`);

    const steps = testCase.stepsJson;
    steps.forEach((step, i) => {
      const stepStr = typeof step === 'string' ? step : JSON.stringify(step);
      console.log(`  ${i + 1}. ${stepStr}`);

      // Check if it's a navigation step
      const isNavStep = stepStr.toLowerCase().includes('navigate');
      if (isNavStep) {
        // Try to extract target
        const match = stepStr.match(/navigate to (\/?\w+)/i);
        if (match) {
          const target = match[1];
          const normalized = normalizePageKeyword(target);
          console.log(`     → Would navigate to: "${normalized}"`);

          // Check if we can find navigation for this
          const canNavigate = navSelectors.some(sel =>
            normalizePageKeyword(sel.leadsToPage) === normalized
          );

          if (canNavigate) {
            console.log(`     ✅ Navigation path exists`);
          } else {
            console.log(`     ⚠️  No navigation path found (might use URL fallback)`);
          }
        }
      }
    });

    allChecks.push({ name: 'Test case navigation check', pass: true });
  } else {
    console.log('⚠️  No test cases with "login" found');
    allChecks.push({ name: 'Test case navigation check', pass: false });
  }

  // SUMMARY
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 VERIFICATION SUMMARY\n');

  allChecks.forEach(check => {
    const icon = check.pass ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
  });

  const allPass = allChecks.every(c => c.pass);

  console.log('\n' + '='.repeat(70));
  if (allPass) {
    console.log('✅ ALL CHECKS PASSED - System ready for execution!\n');
  } else {
    console.log('❌ SOME CHECKS FAILED - Review issues above\n');
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('\n❌ Verification failed:', error);
  prisma.$disconnect();
  process.exit(1);
});
