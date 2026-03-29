/**
 * Migration script to normalize existing navigation selectors in database
 * This fixes selectors that were saved before normalization was added
 */

const { PrismaClient } = require('@prisma/client');
const { normalizePageKeyword } = require('./lib/utils/pageKeywordNormalizer.ts');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migrating Navigation Selectors to Normalized Format\n');
  console.log('='.repeat(60));

  // Find all navigation selectors
  const navSelectors = await prisma.pageSelector.findMany({
    where: { isNavigationElement: true },
    select: {
      id: true,
      pageName: true,
      leadsToPage: true,
      discoveredUrl: true,
    },
  });

  console.log(`\nFound ${navSelectors.length} navigation selectors to check\n`);

  let updated = 0;
  let skipped = 0;

  for (const selector of navSelectors) {
    const currentPageName = selector.pageName;
    const currentLeadsTo = selector.leadsToPage;

    const normalizedPageName = normalizePageKeyword(currentPageName);
    const normalizedLeadsTo = currentLeadsTo ? normalizePageKeyword(currentLeadsTo) : null;

    const needsUpdate =
      currentPageName !== normalizedPageName ||
      (currentLeadsTo && currentLeadsTo !== normalizedLeadsTo);

    if (needsUpdate) {
      console.log(`📝 Updating selector:`);
      console.log(`   From: "${currentPageName}" → "${currentLeadsTo}"`);
      console.log(`   To:   "${normalizedPageName}" → "${normalizedLeadsTo}"`);
      console.log(`   URL:  ${selector.discoveredUrl}`);

      await prisma.pageSelector.update({
        where: { id: selector.id },
        data: {
          pageName: normalizedPageName,
          leadsToPage: normalizedLeadsTo,
        },
      });

      updated++;
      console.log(`   ✅ Updated\n`);
    } else {
      console.log(`✓ Skipping (already normalized): "${currentPageName}" → "${currentLeadsTo}"`);
      skipped++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Migration complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total:   ${navSelectors.length}\n`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('\n❌ Migration failed:', error);
  prisma.$disconnect();
  process.exit(1);
});
