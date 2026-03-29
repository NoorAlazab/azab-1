import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Test database connection
    const userCount = await prisma.user.count();
    const connectionCount = await prisma.jiraConnection.count();
    const testCaseCount = await prisma.testCase.count();

    return NextResponse.json({
      status: "ok",
      database: "connected",
      stats: {
        users: userCount,
        jiraConnections: connectionCount,
        testCases: testCaseCount,
      },
      tables: ["users", "jira_connections", "test_cases"],
      prismaVersion: "6.16.3",
    });

  } catch (error) {
    console.error("Database test error:", error);
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Database connection failed"
    }, { status: 500 });
  }
}