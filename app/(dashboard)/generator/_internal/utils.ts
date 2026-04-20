import type { JiraStoryDetails } from "@/lib/server/generator/types";

/**
 * Pure helpers used by the Generator dashboard. No React, no fetch — keep
 * this file safe to import from anywhere (tests, server components, etc.).
 */

export function timeAgo(date: Date | null | undefined): string {
  if (!date) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Normalize a Jira REST API issue payload into the project's internal
 * `JiraStoryDetails` shape. Tolerates already-normalized payloads (passes
 * them through) and missing fields.
 */
export function transformJiraResponse(rawJira: any): JiraStoryDetails {
  if (!rawJira) {
    return {
      key: "",
      summary: "",
      status: "Unknown",
      projectKey: "",
      issueType: "",
      url: "",
    };
  }

  if (rawJira.key && rawJira.fields) {
    return {
      key: rawJira.key,
      summary: rawJira.fields.summary || "",
      description:
        rawJira.fields.description?.content?.[0]?.content?.[0]?.text ||
        rawJira.fields.description ||
        "",
      acceptanceCriteria: "",
      status: rawJira.fields.status?.name || "Unknown",
      projectKey: rawJira.key.split("-")[0] || "",
      issueType: rawJira.fields.issuetype?.name || "",
      url: `${process.env.NEXT_PUBLIC_JIRA_BASE_URL}/browse/${rawJira.key}`,
    };
  }

  return rawJira;
}
