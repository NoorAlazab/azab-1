const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const runId = 'cmh941rh20009jzesu55gfwlw';

  const run = await prisma.explorationRun.findUnique({
    where: { id: runId },
    include: {
      testExecutions: {
        orderBy: { id: 'asc' }
      }
    }
  });

  if (!run) {
    console.log('Run not found:', runId);
    return;
  }

  console.log('\n=== RUN INFO ===');
  console.log('RunID:', run.id);
  console.log('Status:', run.status);
  console.log('Started:', run.startedAt);
  console.log('Finished:', run.finishedAt);

  console.log('\n=== TEST EXECUTIONS ===');
  run.testExecutions.forEach((exec, i) => {
    console.log(`\n${i+1}. ${exec.testCaseTitle}`);
    console.log(`   Status: ${exec.status}`);
    if (exec.errorMessage) {
      const shortError = exec.errorMessage.length > 80 ? exec.errorMessage.substr(0, 80) + '...' : exec.errorMessage;
      console.log(`   Error: ${shortError}`);
    }
    console.log(`   Started: ${exec.startedAt}`);
    console.log(`   Finished: ${exec.finishedAt}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
