// Test script to verify Prisma setup
import { prisma } from '../lib/server/db/prisma';
import { createUser, getJiraConnection } from '../lib/server/db/database';

async function testPrismaSetup() {
  console.log('Testing Prisma setup...');

  try {
    // Test database connection
    const userCount = await prisma.user.count();
    console.log(`✅ Database connected. Current user count: ${userCount}`);

    // Test user creation
    const testUser = await createUser('test@example.com', '$argon2id$v=19$m=65536,t=3,p=4$hashedpassword', 'Test User');
    console.log(`✅ User created: ${testUser.email} (ID: ${testUser.id})`);

    // Test user retrieval
    const retrievedUser = await getUserById(testUser.id);
    console.log(`✅ User retrieved: ${retrievedUser?.email}`);

    // Test Jira connection check
    const jiraConnection = await getJiraConnection(testUser.id);
    console.log(`✅ Jira connection check: ${jiraConnection ? 'Connected' : 'Not connected'}`);

    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Add missing import
import { getUserById } from '../lib/server/db/database';

// Run if called directly
if (require.main === module) {
  testPrismaSetup();
}