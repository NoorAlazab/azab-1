const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSelectors() {
  try {
    // Count total selectors
    const count = await prisma.pageSelector.count();
    console.log('✓ Total selectors in database:', count);

    // Count by page
    const byPage = await prisma.pageSelector.groupBy({
      by: ['pageName'],
      _count: { id: true },
    });
    console.log('\n📄 Selectors by page:');
    byPage.forEach(p => console.log(`   - ${p.pageName}: ${p._count.id} selectors`));

    // Check navigation selectors
    const navCount = await prisma.pageSelector.count({
      where: { isNavigationElement: true },
    });
    console.log('\n🧭 Navigation selectors:', navCount);

    // Recent selectors
    const samples = await prisma.pageSelector.findMany({
      take: 5,
      orderBy: { recordedAt: 'desc' },
      select: {
        pageName: true,
        elementKey: true,
        elementType: true,
        primarySelector: true,
        isNavigationElement: true,
        leadsToPage: true,
        discoveredUrl: true,
      },
    });

    console.log('\n📋 Recent 5 selectors:');
    samples.forEach(s => {
      const nav = s.isNavigationElement ? ` [NAV → ${s.leadsToPage}]` : '';
      console.log(`   - ${s.pageName} | ${s.elementKey} | ${s.elementType}${nav}`);
      console.log(`     Selector: ${s.primarySelector.substring(0, 60)}${s.primarySelector.length > 60 ? '...' : ''}`);
      if (s.discoveredUrl) console.log(`     URL: ${s.discoveredUrl}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSelectors();
