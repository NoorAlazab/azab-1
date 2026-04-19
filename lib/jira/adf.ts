/**
 * Convert Atlassian Document Format (ADF) to plain text
 */

export interface AdfNode {
  type: string;
  content?: AdfNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export type AdfDocument = {
  version: number;
  type: "doc";
  content: AdfNode[];
};

/**
 * Convert ADF JSON to plain text by flattening paragraphs and text nodes
 */
export function adfToText(adf: unknown): string {
  if (!adf || typeof adf !== 'object') {
    return typeof adf === 'string' ? adf : JSON.stringify(adf) || '';
  }

  function extractText(node: AdfNode): string {
    if (!node || typeof node !== 'object') {
      return '';
    }

    // If it's a text node, return the text
    if (node.type === 'text' && node.text) {
      return node.text;
    }

    // If it has content, recursively extract from children
    if (node.content && Array.isArray(node.content)) {
      const childTexts = node.content.map(extractText).filter(Boolean);
      
      // Add line breaks for certain block elements
      if (node.type === 'paragraph' || node.type === 'heading') {
        return childTexts.join('') + '\n';
      }
      
      // Add list item prefix for list items
      if (node.type === 'listItem') {
        return '• ' + childTexts.join('') + '\n';
      }
      
      return childTexts.join('');
    }

    return '';
  }

  try {
    const text = extractText(adf as AdfNode);
    return text.trim() || JSON.stringify(adf);
  } catch (error) {
    console.warn('Failed to parse ADF:', error);
    return JSON.stringify(adf) || '';
  }
}

/**
 * Convert any value to text - handles both strings and ADF objects
 */
export function asText(value: unknown): string {
  if (!value) return '';
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'object') {
    return adfToText(value);
  }
  
  return String(value);
}

// Minimal helpers to build a Jira ADF doc that renders fine in comments.
export function paragraph(text: string): AdfNode {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

export function codeBlock(text: string): AdfNode {
  return { type: "codeBlock", attrs: { language: "markdown" }, content: [{ type: "text", text }] };
}

export function doc(content: AdfNode[]): AdfDocument {
  return { version: 1, type: "doc", content };
}

export function heading(level: number, text: string): AdfNode {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }]
  };
}

export function orderedList(items: string[]): AdfNode {
  return {
    type: "orderedList",
    content: items.map(item => ({
      type: "listItem",
      content: [paragraph(item)]
    }))
  };
}

export function strongText(text: string): AdfNode {
  return {
    type: "text",
    text,
    marks: [{ type: "strong" }]
  };
}

export function paragraphWithStrong(strongText: string, normalText: string): AdfNode {
  return {
    type: "paragraph",
    content: [
      { type: "text", text: strongText, marks: [{ type: "strong" }] },
      { type: "text", text: normalText }
    ]
  };
}

/**
 * Minimal Markdown -> ADF converter (paragraphs, h1/h2, bullet lists).
 * Migrated from the deprecated lib/jira/api.ts so callers do not pull
 * the dead module back in for a single helper. For full Markdown support
 * a dedicated library would be needed.
 */
export function markdownToADF(markdown: string): AdfDocument {
  const lines = markdown.split("\n");
  const content: AdfNode[] = [];

  for (const line of lines) {
    if (line.trim() === "") continue;

    if (line.startsWith("# ")) {
      content.push(heading(1, line.substring(2)));
    } else if (line.startsWith("## ")) {
      content.push(heading(2, line.substring(3)));
    } else if (line.startsWith("- ")) {
      const last = content[content.length - 1];
      if (!last || last.type !== "bulletList") {
        content.push({ type: "bulletList", content: [] });
      }
      const listNode = content[content.length - 1];
      (listNode.content ??= []).push({
        type: "listItem",
        content: [paragraph(line.substring(2))]
      });
    } else {
      content.push(paragraph(line));
    }
  }

  return doc(content);
}
