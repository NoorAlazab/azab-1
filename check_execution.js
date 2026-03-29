const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const exec = await prisma.testExecution.findUnique({
      where: { id: 'cmhbs0g6k000ojzjgd4511sv7' },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        screenshotUrl: true,
        duration: true,
        testCaseTitle: true,
        actualResult: true,
        updatedAt: true
      }
    });

    console.log('=== TEST EXECUTION STATUS ===');
    console.log(JSON.stringify(exec, null, 2));

    // Also check the run
    const run = await prisma.explorationRun.findFirst({
      where: {
        testExecutions: {
          some: { id: 'cmhbs0g6k000ojzjgd4511sv7' }
        }
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        statsJson: true
      }
    });

    console.log('\n=== EXPLORATION RUN STATUS ===');
    console.log(JSON.stringify(run, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
