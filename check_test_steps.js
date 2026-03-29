const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('📋 Checking Test Case Steps\n');

  // Find a test case with login
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
    console.log('Test Case:', testCase.title);
    console.log('\nSteps:');
    const steps = testCase.stepsJson;
    steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${JSON.stringify(step)}`);
    });
  } else {
    console.log('No test case found with "login" in title');

    // Show any test case
    const anyCase = await prisma.testCase.findFirst({
      select: { title: true, stepsJson: true }
    });

    if (anyCase) {
      console.log('\nFound test case:', anyCase.title);
      console.log('\nSteps:');
      const steps = anyCase.stepsJson;
      steps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${JSON.stringify(step)}`);
      });
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
