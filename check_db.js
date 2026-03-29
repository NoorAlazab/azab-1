const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get the most recent exploration run by startedAt
  const run = await prisma.explorationRun.findFirst({
    orderBy: { startedAt: 'desc' },
    include: {
      testExecutions: true,
    },
  });

  if (!run) {
    console.log('No runs found');
    return;
  }

  console.log('Most recent run:', {
    id: run.id,
    status: run.status,
    issueKey: run.issueKey,
    testExecutionsCount: run.testExecutions.length,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  });

  console.log('\nTest execution statuses:');
  run.testExecutions.forEach((exec, i) => {
    console.log(`  ${i+1}. ${exec.testCaseTitle}: ${exec.status}`);
    if (exec.errorMessage) {
      console.log(`     Error: ${exec.errorMessage}`);
    }
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
