import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { JiraError } from "@/lib/server/jira/errors";
import { makeJiraApiCallDB } from "@/lib/server/jira/auth";
import { markdownToADF } from "@/lib/server/jira/adf";
import { parseIssueKey } from "@/lib/server/jira/issueKey";

// Simple validation schema
const PublishBodySchema = z.object({
  issueKey: z.string().optional(),
  issueLink: z.string().optional(),
  mode: z.literal("comment"),
  cases: z.array(z.object({
    title: z.string(),
    description: z.string(),
    steps: z.array(z.string()),
    expectedResult: z.string()
  }))
}).refine(data => data.issueKey || data.issueLink, {
  message: "Either issueKey or issueLink must be provided"
});

function formatTestSuiteMarkdown(cases: any[]): string {
  let markdown = "# Generated Test Cases\n\n";
  
  cases.forEach((testCase, index) => {
    markdown += `## Test Case ${index + 1}: ${testCase.title}\n\n`;
    markdown += `**Description:** ${testCase.description}\n\n`;
    markdown += `**Steps:**\n`;
    testCase.steps.forEach((step: string, stepIndex: number) => {
      markdown += `- ${step}\n`;
    });
    markdown += `\n**Expected Result:** ${testCase.expectedResult}\n\n`;
    markdown += "---\n\n";
  });
  
  return markdown;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = PublishBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validation.error.format(),
        },
        { status: 422 }
      );
    }

    const { issueKey: providedKey, issueLink, mode, cases } = validation.data;
    
    // Determine the final issue key
    let issueKey = providedKey;
    if (!issueKey && issueLink) {
      issueKey = parseIssueKey(issueLink) || undefined;
    }
    
    if (!issueKey) {
      return NextResponse.json(
        { error: "Valid issue key or link is required" },
        { status: 400 }
      );
    }

    if (mode === "comment") {
      const markdown = formatTestSuiteMarkdown(cases);
      const comment = await makeJiraApiCallDB(`issue/${issueKey}/comment`, {
        method: "POST",
        body: JSON.stringify({ body: markdownToADF(markdown) }),
      });

      return NextResponse.json({
        success: true,
        issueKey,
        mode,
        casesCount: cases.length,
        commentId: comment.id,
      });
    } else {
      return NextResponse.json(
        { error: "Only comment mode is supported currently" },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error("Publish test cases error:", error);
    
    if (error instanceof JiraError) {
      return NextResponse.json(
        { error: error.jiraError.message, type: error.jiraError.type },
        { status: error.jiraError.status }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to publish test cases" },
      { status: 500 }
    );
  }
}

