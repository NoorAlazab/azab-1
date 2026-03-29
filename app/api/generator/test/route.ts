import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/iron";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const userId = requireUserId();
    
    // Test basic database connectivity
    const suiteCount = await (prisma as any).testSuite.count({
      where: { userId }
    });
    
    const caseCount = await (prisma as any).testCase.count();
    
    return NextResponse.json({
      status: "ok",
      message: "Test suite API is working",
      data: {
        userId,
        suiteCount,
        totalCases: caseCount,
        hasOpenAI: !!process.env.OPENAI_API_KEY
      }
    });
    
  } catch (error: any) {
    return NextResponse.json({
      status: "error", 
      message: error.message || "API test failed"
    }, { status: 500 });
  }
}