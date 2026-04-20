import type { Page } from "playwright";
import { normalizeLabel } from "./intent";

export interface CTACandidate {
  role: string;
  name: string;
  normalizedName: string;
  selectorShort: string;
  bbox: { x: number; y: number; width: number; height: number };
  prominence: number;
  isVisible: boolean;
  isClickable: boolean;
}

/**
 * Collect all visible, clickable CTA candidates from page
 * Focuses on buttons and links with accessible names
 */
export async function collectCandidates(page: Page): Promise<CTACandidate[]> {
  console.log("[Locators] Collecting CTA candidates...");

  const candidates = await page.evaluate(() => {
    const results: Omit<CTACandidate, "normalizedName">[] = [];

    // Find all buttons
    const buttons = Array.from(document.querySelectorAll("button"));
    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      const isVisible =
        rect.width > 0 &&
        rect.height > 0 &&
        window.getComputedStyle(button).visibility !== "hidden" &&
        window.getComputedStyle(button).display !== "none";

      if (!isVisible) continue;

      const name =
        button.getAttribute("aria-label") ||
        button.textContent?.trim() ||
        button.getAttribute("title") ||
        "";

      if (!name) continue;

      const isClickable = !button.disabled && !button.hasAttribute("aria-disabled");

      // Calculate prominence (size + position)
      const inHeader = button.closest("header") !== null;
      const inMain = button.closest("main") !== null;
      const inForm = button.closest("form") !== null;
      const prominence =
        rect.width * rect.height +
        (inHeader ? 10000 : 0) +
        (inMain ? 5000 : 0) +
        (inForm ? 3000 : 0);

      // Generate short selector
      const id = button.id;
      const classes = Array.from(button.classList)
        .filter((c) => c.length < 20)
        .slice(0, 2)
        .join(".");
      const selectorShort = id
        ? `#${id}`
        : classes
        ? `button.${classes}`
        : `button:has-text("${name.substring(0, 20)}")`;

      results.push({
        role: "button",
        name,
        selectorShort,
        bbox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        prominence,
        isVisible,
        isClickable,
      });
    }

    // Find all links that look like buttons (CTA links)
    const links = Array.from(document.querySelectorAll("a[href]"));
    for (const link of links) {
      const rect = link.getBoundingClientRect();
      const isVisible =
        rect.width > 0 &&
        rect.height > 0 &&
        window.getComputedStyle(link).visibility !== "hidden" &&
        window.getComputedStyle(link).display !== "none";

      if (!isVisible) continue;

      const name =
        link.getAttribute("aria-label") ||
        link.textContent?.trim() ||
        link.getAttribute("title") ||
        "";

      if (!name) continue;

      // Only include links that look like buttons (have button-like styling or role)
      const role = link.getAttribute("role");
      const classes = link.className.toLowerCase();
      const looksLikeButton =
        role === "button" ||
        classes.includes("btn") ||
        classes.includes("button") ||
        classes.includes("cta");

      if (!looksLikeButton) continue;

      const isClickable = true; // Links are generally clickable

      const inHeader = link.closest("header") !== null;
      const inMain = link.closest("main") !== null;
      const prominence =
        rect.width * rect.height + (inHeader ? 10000 : 0) + (inMain ? 5000 : 0);

      const id = link.id;
      const classStr = Array.from(link.classList)
        .filter((c) => c.length < 20)
        .slice(0, 2)
        .join(".");
      const selectorShort = id
        ? `#${id}`
        : classStr
        ? `a.${classStr}`
        : `a:has-text("${name.substring(0, 20)}")`;

      results.push({
        role: role || "link",
        name,
        selectorShort,
        bbox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        prominence,
        isVisible,
        isClickable,
      });
    }

    // Sort by prominence (descending)
    return results.sort((a, b) => b.prominence - a.prominence);
  });

  // Add normalized names
  const withNormalized = candidates.map((c) => ({
    ...c,
    normalizedName: normalizeLabel(c.name),
  }));

  console.log(`[Locators] Found ${withNormalized.length} candidates`);
  return withNormalized;
}

/**
 * Pick the primary CTA from candidates
 * Most prominent CTA in header or main area
 */
export function pickPrimaryCTA(candidates: CTACandidate[]): CTACandidate | null {
  if (candidates.length === 0) return null;

  // Filter to only visible and clickable
  const viable = candidates.filter((c) => c.isVisible && c.isClickable);
  if (viable.length === 0) return null;

  // Return the most prominent (already sorted)
  return viable[0];
}

/**
 * Find candidates matching specific terms
 */
export function findMatchingCandidates(
  candidates: CTACandidate[],
  terms: string[]
): CTACandidate[] {
  const normalizedTerms = terms.map((t) => normalizeLabel(t));
  return candidates.filter((c) => normalizedTerms.includes(c.normalizedName));
}
