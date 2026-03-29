const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const runId = 'cmhaj0q8e000djz9ozvhs48k6';

  const run = await prisma.explorationRun.findUnique({
    where: { id: runId },
    include: {
      testExecutions: {
        select: {
          testCaseTitle: true,
          status: true,
          errorMessage: true
        },
        orderBy: { id: 'asc' }
      }
    }
  });

  if (!run) {
    console.log('Run not found');
    return;
  }

  console.log('\n=== RUN STATUS ===');
  console.log('Status:', run.status);
  console.log('\n=== TEST EXECUTIONS ===');
  run.testExecutions.forEach((t, i) => {
    console.log(`\n${i+1}. ${t.testCaseTitle}`);
    console.log(`   Status: ${t.status}`);
    if (t.errorMessage) {
      console.log(`   Error: ${t.errorMessage.substring(0, 100)}...`);
    }
  });

  await prisma.$disconnect();
}

main().catch(console.error);
