// Script to clear test cases for SCRUM-18 so we can test clean
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // Find the SCRUM-18 suite
    const suite = await prisma.testSuite.findFirst({
      where: { issueKey: 'SCRUM-18' },
      include: { cases: true }
    });
    
    if (!suite) {
      console.log('SCRUM-18 suite not found');
      return;
    }
    
    console.log(`Found SCRUM-18 suite with ${suite.cases.length} test cases`);
    console.log('Deleting all test cases...');
    
    // Delete all test cases for this suite
    const result = await prisma.testCase.deleteMany({
      where: { suiteId: suite.id }
    });
    
    console.log(`Deleted ${result.count} test cases`);
    console.log('SCRUM-18 suite is now empty and ready for testing');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();