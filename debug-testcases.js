// Debug script to check test cases in database
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== All Test Suites ===');
    const suites = await prisma.testSuite.findMany({
      include: {
        cases: {
          orderBy: { order: 'asc' }
        }
      }
    });
    
    suites.forEach(suite => {
      console.log(`\nSuite ID: ${suite.id}`);
      console.log(`Issue Key: ${suite.issueKey}`);
      console.log(`User ID: ${suite.userId}`);
      console.log(`Test Cases (${suite.cases.length}):`);
      
      suite.cases.forEach((tc, i) => {
        console.log(`  ${i + 1}. ${tc.title} (${tc.type}, ${tc.priority})`);
        console.log(`     Order: ${tc.order}, ID: ${tc.id}`);
      });
    });
    
    console.log('\n=== Recent Test Cases (last 10) ===');
    const recentCases = await prisma.testCase.findMany({
      take: 10,
      orderBy: { id: 'desc' },
      include: {
        suite: {
          select: { issueKey: true, userId: true }
        }
      }
    });
    
    recentCases.forEach(tc => {
      console.log(`${tc.title} - Suite: ${tc.suite.issueKey} (ID: ${tc.suiteId})`);
      console.log(`  Type: ${tc.type}, Priority: ${tc.priority}, Order: ${tc.order}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();