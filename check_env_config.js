const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkEnvConfig() {
  try {
    const envCount = await prisma.environmentConfig.count();
    console.log('✓ Total environment configs:', envCount);

    const envs = await prisma.environmentConfig.findMany({
      select: {
        id: true,
        environmentSlug: true,
        userId: true,
        environmentUrl: true,
        lastRecordedAt: true,
      },
    });

    if (envs.length > 0) {
      console.log('\n📁 Environment configs:');
      envs.forEach(e => {
        console.log(`   - ID: ${e.id}`);
        console.log(`     Slug: ${e.environmentSlug}`);
        console.log(`     URL: ${e.environmentUrl}`);
        console.log(`     User: ${e.userId}`);
        console.log(`     Last Recorded: ${e.lastRecordedAt ? e.lastRecordedAt.toISOString() : 'Never'}`);
        console.log('');
      });
    } else {
      console.log('\n⚠️  No environment configs found. This is why selectors can\'t be saved to database!');
      console.log('Environment configs are needed to associate selectors with specific environments.');
    }

    // Check PageJourney table too
    const journeyCount = await prisma.pageJourney.count();
    console.log('📍 Total page journeys:', journeyCount);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkEnvConfig();
