import { prisma } from "@/lib/db/prisma";
import { addActivityEvent } from "@/lib/db/activity";

export type ChecklistItemKey =
  | "connectJira"
  | "configureLLM"
  | "chooseStorageMode"
  | "firstSuite";

export interface ChecklistView {
  connectJira: boolean;
  configureLLM: boolean;
  chooseStorageMode: boolean;
  firstSuite: boolean;
}

const defaultChecklist: ChecklistView = {
  connectJira: false,
  configureLLM: false,
  chooseStorageMode: false,
  firstSuite: false,
};

const checklistItemTitles: Record<ChecklistItemKey, string> = {
  connectJira: "Connect Jira",
  configureLLM: "Configure LLM",
  chooseStorageMode: "Choose Test Storage Mode",
  firstSuite: "Generate Your First Suite",
};

/**
 * Fetch the checklist for a user. Returns the default (all-false) checklist
 * if none has been persisted yet — matches the previous in-memory contract
 * so callers do not need to special-case "user has no checklist row yet".
 */
export async function getChecklist(userId: string): Promise<ChecklistView> {
  const row = await prisma.checklist.findUnique({ where: { userId } });
  if (!row) return { ...defaultChecklist };
  return {
    connectJira: row.connectJira,
    configureLLM: row.configureLLM,
    chooseStorageMode: row.chooseStorageMode,
    firstSuite: row.firstSuite,
  };
}

/**
 * Set a single checklist item. Upserts so the checklist row is created
 * lazily on first interaction. When transitioning a value to true we also
 * append a success activity event, mirroring the legacy in-memory behavior.
 */
export async function updateChecklistItem(
  userId: string,
  item: ChecklistItemKey,
  value: boolean,
): Promise<void> {
  await prisma.checklist.upsert({
    where: { userId },
    create: {
      userId,
      ...defaultChecklist,
      [item]: value,
    },
    update: { [item]: value },
  });

  if (value) {
    await addActivityEvent(userId, {
      type: "generation",
      title: `Completed: ${checklistItemTitles[item]}`,
      status: "success",
    });
  }
}
