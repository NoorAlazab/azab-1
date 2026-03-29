/**
 * Debug script to track test execution status flow
 * This script shows the full lifecycle of test statuses
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
});

async function main() {
  console.log('\n========================================');
  console.log('DEBUG: Test Execution Status Flow');
  console.log('========================================\n');

  // Get the latest exploration run
  const latestRun = await prisma.explorationRun.findFirst({
    orderBy: { startedAt: 'desc' },
    include: {
      testExecutions: {
        select: {
          id: true,
          testCaseTitle: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          finishedAt: true,
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!latestRun) {
    console.log('❌ No exploration runs found in database');
    await prisma.$disconnect();
    return;
  }

  console.log('📊 Latest Run Information:');
  console.log('─────────────────────────────────────────');
  console.log('Run ID:', latestRun.id);
  console.log('Status:', latestRun.status);
  console.log('Started:', latestRun.startedAt?.toISOString());
  console.log('Finished:', latestRun.finishedAt?.toISOString());
  console.log('Environment:', latestRun.environment);
  console.log('Test Executions Count:', latestRun.testExecutions.length);
  console.log();

  // Analyze test executions
  console.log('🔍 Test Executions Analysis:');
  console.log('─────────────────────────────────────────');

  const statusCounts = {
    pending: 0,
    running: 0,
    passed: 0,
    failed: 0,
    error: 0,
  };

  latestRun.testExecutions.forEach((exec, index) => {
    console.log(`\n${index + 1}. ${exec.testCaseTitle}`);
    console.log(`   ID: ${exec.id}`);
    console.log(`   Status: ${exec.status} ${exec.status === 'pending' ? '⚠️' : exec.status === 'passed' ? '✅' : '❌'}`);
    console.log(`   Created: ${exec.createdAt.toISOString()}`);
    console.log(`   Finished: ${exec.finishedAt ? exec.finishedAt.toISOString() : 'N/A'}`);

    if (exec.errorMessage) {
      console.log(`   Error: ${exec.errorMessage.substring(0, 100)}${exec.errorMessage.length > 100 ? '...' : ''}`);
    }

    statusCounts[exec.status] = (statusCounts[exec.status] || 0) + 1;
  });

  console.log('\n📈 Status Summary:');
  console.log('─────────────────────────────────────────');
  console.log(`Total: ${latestRun.testExecutions.length}`);
  console.log(`✅ Passed: ${statusCounts.passed}`);
  console.log(`❌ Failed: ${statusCounts.failed}`);
  console.log(`💥 Error: ${statusCounts.error}`);
  console.log(`⏳ Pending: ${statusCounts.pending}`);
  console.log(`🔄 Running: ${statusCounts.running}`);

  // Check for stuck pending tests
  if (statusCounts.pending > 0 && latestRun.status === 'completed') {
    console.log('\n⚠️  WARNING: Tests are stuck in PENDING state!');
    console.log('   Run is marked as "completed" but has pending tests.');
    console.log('   This indicates the execute endpoint did not update test statuses.');
  }

  // Verify database consistency
  console.log('\n🔬 Database Consistency Check:');
  console.log('─────────────────────────────────────────');

  // Re-query the same tests individually to check for caching
  for (const exec of latestRun.testExecutions.slice(0, 3)) {
    const freshExec = await prisma.testExecution.findUnique({
      where: { id: exec.id },
      select: { id: true, status: true, testCaseTitle: true }
    });

    const match = freshExec?.status === exec.status ? '✅' : '❌ MISMATCH!';
    console.log(`${match} ${exec.testCaseTitle}: ${exec.status} vs ${freshExec?.status}`);
  }

  console.log('\n========================================\n');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
