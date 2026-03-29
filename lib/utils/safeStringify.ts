/**
 * Safe JSON stringification utilities that handle circular references,
 * Error objects, Response objects, and other unserializable types.
 */

export function safeReplacer(): (key: string, value: any) => any {
  const seen = new WeakSet();
  
  return function(key: string, value: any) {
    // Handle primitives
    if (value === null || typeof value !== "object") {
      return value;
    }
    
    // Handle circular references
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    
    // Handle Error objects
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack?.slice(0, 1000) // Limit stack trace length
      };
    }
    
    // Handle Response objects
    if (typeof Response !== 'undefined' && value instanceof Response) {
      return {
        ok: value.ok,
        status: value.status,
        statusText: value.statusText,
        url: value.url,
        headers: Object.fromEntries(value.headers.entries())
      };
    }
    
    // Handle Request objects
    if (typeof Request !== 'undefined' && value instanceof Request) {
      return {
        method: value.method,
        url: value.url,
        headers: Object.fromEntries(value.headers.entries())
      };
    }
    
    // Handle URL objects
    if (value instanceof URL) {
      return value.toString();
    }
    
    // Handle Headers objects
    if (typeof Headers !== 'undefined' && value instanceof Headers) {
      return Object.fromEntries(value.entries());
    }
    
    // Handle Buffer objects
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
      return `[Buffer ${value.length} bytes]`;
    }
    
    // Handle ArrayBuffer objects
    if (value instanceof ArrayBuffer) {
      return `[ArrayBuffer ${value.byteLength} bytes]`;
    }
    
    // Handle ReadableStream objects
    if (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) {
      return "[ReadableStream]";
    }
    
    // Handle functions
    if (typeof value === "function") {
      return `[Function: ${value.name || 'anonymous'}]`;
    }
    
    // Handle React elements/components (they often have circular refs)
    if (value && typeof value === 'object' && value.$$typeof) {
      return "[React Element]";
    }
    
    // Handle DOM nodes
    if (typeof Node !== 'undefined' && value instanceof Node) {
      return `[${value.nodeName}]`;
    }
    
    return value;
  };
}

export function safeStringify(value: any, space: number = 2): string {
  try {
    const result = JSON.stringify(value, safeReplacer(), space);
    
    // Truncate very large strings
    if (result.length > 20000) {
      return result.slice(0, 20000) + "\n... [truncated]";
    }
    
    return result;
  } catch (error) {
    // Fallback if even our safe replacer fails
    return `[Unable to stringify: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }
}

export function toDisplayDetail(detail: unknown): string | null {
  // Handle null/undefined
  if (detail == null) {
    return null;
  }
  
  // Handle strings
  if (typeof detail === 'string') {
    if (detail.trim() === '') {
      return null;
    }
    return detail.length > 20000 ? detail.slice(0, 20000) + "\n... [truncated]" : detail;
  }
  
  // Handle numbers/booleans
  if (typeof detail === 'number' || typeof detail === 'boolean') {
    return String(detail);
  }
  
  // Handle arrays and objects
  if (typeof detail === 'object') {
    // Handle empty objects/arrays
    if (Array.isArray(detail) && detail.length === 0) {
      return null;
    }
    if (Object.keys(detail as object).length === 0) {
      return null;
    }
    
    // Use safe stringify for complex objects
    const stringified = safeStringify(detail);
    return stringified === '{}' || stringified === '[]' ? null : stringified;
  }
  
  // Fallback for other types
  return String(detail);
}