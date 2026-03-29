/**
 * Convert Atlassian Document Format (ADF) to plain text
 */

interface AdfNode {
  type: string;
  content?: AdfNode[];
  text?: string;
  attrs?: Record<string, any>;
}

/**
 * Convert ADF JSON to plain text by flattening paragraphs and text nodes
 */
export function adfToText(adf: any): string {
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
    const text = extractText(adf);
    return text.trim() || JSON.stringify(adf);
  } catch (error) {
    console.warn('Failed to parse ADF:', error);
    return JSON.stringify(adf) || '';
  }
}

/**
 * Convert any value to text - handles both strings and ADF objects
 */
export function asText(value: any): string {
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
export function paragraph(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

export function codeBlock(text: string) {
  return { type: "codeBlock", attrs: { language: "markdown" }, content: [{ type: "text", text }] };
}

export function doc(content: any[]) {
  return { version: 1, type: "doc", content };
}

export function heading(level: number, text: string) {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }]
  };
}

export function orderedList(items: string[]) {
  return {
    type: "orderedList",
    content: items.map(item => ({
      type: "listItem",
      content: [paragraph(item)]
    }))
  };
}

export function strongText(text: string) {
  return {
    type: "text",
    text,
    marks: [{ type: "strong" }]
  };
}

export function paragraphWithStrong(strongText: string, normalText: string) {
  return {
    type: "paragraph",
    content: [
      { type: "text", text: strongText, marks: [{ type: "strong" }] },
      { type: "text", text: normalText }
    ]
  };
}