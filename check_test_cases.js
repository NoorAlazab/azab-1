const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTestCases() {
  const cases = await prisma.testCase.findMany({
    where: { suiteId: 'cmh3cygh4000djzy8ngk6n5py' },
    orderBy: { order: 'asc' }
  });

  console.log('Test Cases for SCRUM-2:\n');
  cases.forEach((tc, i) => {
    console.log(`${i + 1}. ${tc.title}`);
    console.log('   Steps:');
    if (typeof tc.stepsJson === 'string') {
      try {
        const steps = JSON.parse(tc.stepsJson);
        steps.forEach((step, j) => {
          console.log(`      ${j + 1}. ${step}`);
        });
      } catch (e) {
        // Already a string array, not JSON
        console.log('      ', tc.stepsJson);
      }
    } else {
      tc.stepsJson.forEach((step, j) => {
        console.log(`      ${j + 1}. ${step}`);
      });
    }
    console.log('');
  });

  await prisma.$disconnect();
}

checkTestCases().catch(console.error);
