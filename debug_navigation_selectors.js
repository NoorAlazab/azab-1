/**
 * Debug script to check navigation selectors in database
 * Run with: node debug_navigation_selectors.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking Navigation Selectors in Database\n');
  console.log('=' .repeat(60));

  try {
    // Get all navigation selectors
    const navSelectors = await prisma.pageSelector.findMany({
      where: { isNavigationElement: true },
      select: {
        id: true,
        environmentConfigId: true,
        sourcePageName: true,
        pageName: true,
        elementKey: true,
        primarySelector: true,
        leadsToPage: true,
        discoveredUrl: true,
        urlLastVerified: true,
        urlVerificationCount: true,
        recordedBy: true,
      },
      orderBy: { recordedAt: 'desc' },
    });

    console.log(`\n✓ Total navigation selectors: ${navSelectors.length}\n`);

    if (navSelectors.length === 0) {
      console.log('❌ NO NAVIGATION SELECTORS FOUND!');
      console.log('\nThis means:');
      console.log('  1. Recording didn\'t save navigation selectors');
      console.log('  2. Or the navigationSelector field was not populated on journeys');
      console.log('  3. Or an error occurred during saving');
      console.log('\nExecution will fall back to URL navigation.');
    } else {
      console.log('📋 Navigation Selectors:\n');
      navSelectors.forEach((sel, idx) => {
        console.log(`${idx + 1}. Navigation Element`);
        console.log(`   From: "${sel.sourcePageName || 'N/A'}"`);
        console.log(`   To: "${sel.leadsToPage || 'N/A'}"`);
        console.log(`   Element Key: ${sel.elementKey}`);
        console.log(`   Selector: ${sel.primarySelector}`);
        console.log(`   Discovered URL: ${sel.discoveredUrl || 'N/A'}`);
        console.log(`   Verification Count: ${sel.urlVerificationCount}`);
        console.log(`   Recorded By Story: ${sel.recordedBy || 'none'}`);
        console.log('');
      });

      // Check for common navigation paths
      console.log('\n🔗 Common Navigation Paths:');
      const dashboardToLogin = navSelectors.find(s =>
        s.sourcePageName === 'dashboard' && s.leadsToPage === 'login'
      );
      const homeToLogin = navSelectors.find(s =>
        s.sourcePageName === 'home' && s.leadsToPage === 'login'
      );

      console.log(`  dashboard → login: ${dashboardToLogin ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`  home → login: ${homeToLogin ? '✅ EXISTS' : '❌ MISSING'}`);
    }

    // Check page journeys too
    console.log('\n' + '='.repeat(60));
    console.log('\n📚 Page Journeys in Database:\n');

    const journeys = await prisma.pageJourney.findMany({
      take: 10,
      orderBy: { recordedAt: 'desc' },
      select: {
        fromPage: true,
        toPage: true,
        navigationSteps: true,
      },
    });

    console.log(`✓ Total journeys: ${journeys.length}\n`);

    if (journeys.length > 0) {
      journeys.forEach((j, idx) => {
        console.log(`${idx + 1}. Journey: ${j.fromPage} → ${j.toPage}`);
        console.log(`   Steps: ${JSON.stringify(j.navigationSteps).substring(0, 100)}...`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
