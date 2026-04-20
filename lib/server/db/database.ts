import { prisma } from './prisma';
import { AppUser, JiraConnection, JiraSite } from '@/types/auth';

// User operations
export async function createUser(email: string, passwordHash: string, name?: string): Promise<AppUser> {
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    return existingUser;
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
    },
  });

  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getUserById(userId: string): Promise<AppUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// Jira Connection operations
export async function createOrUpdateJiraConnection(
  userId: string,
  accessTokenEncrypted: string,
  refreshTokenEncrypted: string | null,
  sites: Array<{ id: string; name: string; url: string; scopes?: string[] }>,
  expiresAt?: Date
): Promise<JiraConnection> {
  const existingConnection = await prisma.jiraConnection.findFirst({
    where: { userId },
  });

  const connectionData = {
    userId,
    accessTokenEncrypted,
    refreshTokenEncrypted,
    activeCloudId: sites[0]?.id || null,
    sites: sites,
    expiresAt,
  };

  let connection;
  if (existingConnection) {
    connection = await prisma.jiraConnection.update({
      where: { id: existingConnection.id },
      data: connectionData,
    });
  } else {
    connection = await prisma.jiraConnection.create({
      data: connectionData,
    });
  }

  return {
    connected: true,
    activeCloudId: connection.activeCloudId,
    sites: connection.sites as unknown as JiraSite[],
    accessTokenEncrypted: connection.accessTokenEncrypted,
    refreshTokenEncrypted: connection.refreshTokenEncrypted || undefined,
    expiresAt: connection.expiresAt || undefined,
  };
}

export async function getJiraConnection(userId: string): Promise<JiraConnection | null> {
  const connection = await prisma.jiraConnection.findFirst({
    where: { userId },
  });

  if (!connection) return null;

  return {
    connected: true,
    activeCloudId: connection.activeCloudId,
    sites: connection.sites as unknown as JiraSite[],
    accessTokenEncrypted: connection.accessTokenEncrypted,
    refreshTokenEncrypted: connection.refreshTokenEncrypted || undefined,
    expiresAt: connection.expiresAt || undefined,
  };
}

export async function updateActiveJiraSite(userId: string, cloudId: string): Promise<void> {
  await prisma.jiraConnection.updateMany({
    where: { userId },
    data: { activeCloudId: cloudId },
  });
}

export async function deleteJiraConnection(userId: string): Promise<void> {
  await prisma.jiraConnection.deleteMany({
    where: { userId },
  });
}

// Test Case operations - DEPRECATED: Using new TestSuite/TestCase structure
// export async function createTestCase(
//   userId: string,
//   issueKey: string,
//   title: string,
//   steps: string[] | any[],
//   expected: string,
//   priority?: string,
//   environment?: string
// ) {
//   return await prisma.testCase.create({
//     data: {
//       userId,
//       issueKey,
//       title,
//       steps,
//       expected,
//       priority,
//       environment,
//     },
//   });
// }

// export async function getTestCasesByIssue(userId: string, issueKey: string) {
//   return await prisma.testCase.findMany({
//     where: {
//       userId,
//       issueKey,
//     },
//     orderBy: {
//       createdAt: 'desc',
//     },
//   });
// }

// export async function markTestCasePublished(
//   id: string,
//   publishedAs: 'comment' | 'subtask',
//   jiraId: string
// ) {
//   return await prisma.testCase.update({
//     where: { id },
//     data: {
//       status: 'published',
//       publishedAs,
//       jiraId,
//     },
//   });
// }