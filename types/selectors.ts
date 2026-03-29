/**
 * TypeScript types for the Selector Repository System
 * These types define the structure of selector mapping files
 */

/**
 * Element type classification
 */
export type ElementType =
  | 'button'      // Buttons, submit buttons
  | 'input'       // Text inputs, email, password fields
  | 'select'      // Dropdown menus
  | 'checkbox'    // Checkboxes
  | 'radio'       // Radio buttons
  | 'link'        // Anchor tags, navigation links
  | 'text'        // Static text elements to verify
  | 'container'   // Divs, sections used for context
  | 'image'       // Images
  | 'form'        // Form elements
  | 'table'       // Tables
  | 'list'        // Lists (ul, ol)
  | 'other';      // Other element types

/**
 * Metadata about an element
 */
export interface ElementMetadata {
  /** Element type classification */
  type: ElementType;

  /** Visible text on the element (for buttons, links) */
  text?: string;

  /** ARIA label or associated label text */
  label?: string;

  /** Human-readable description of what this element does */
  description?: string;

  /** Placeholder text (for inputs) */
  placeholder?: string;

  /** Name attribute value */
  name?: string;

  /** ID attribute value */
  id?: string;

  /** Last date this selector was verified to work (ISO 8601) */
  lastVerified?: string;

  /** Notes about this element */
  notes?: string;
}

/**
 * Context information to help locate elements
 * Useful when multiple similar elements exist on a page
 */
export interface ElementContext {
  /** Selector for an element this element should be near */
  nearElement?: string;

  /** Selector for a container this element should be inside */
  insideContainer?: string;

  /** Index if multiple matches exist (0-based) */
  index?: number;

  /** Additional context notes */
  notes?: string;
}

/**
 * A single element selector definition
 */
export interface ElementSelector {
  /** Unique key to identify this element (camelCase, e.g., "loginButton") */
  key: string;

  /** Primary selector (most reliable, should be used first) */
  primary: string;

  /** Fallback selectors to try if primary fails (in order of preference) */
  fallbacks: string[];

  /** Metadata about the element */
  metadata: ElementMetadata;

  /** Context information (optional) */
  context?: ElementContext;

  /** Custom validation function name (optional, advanced usage) */
  validator?: string;
}

/**
 * A complete selector mapping file for a page
 */
export interface SelectorMapping {
  /** Page path or identifier (e.g., "/login", "dashboard") */
  page: string;

  /** Human-readable description of this page */
  description?: string;

  /** Base URL for this page (optional, overrides default) */
  baseUrl?: string;

  /** Map of element keys to their selector definitions */
  elements: Record<string, ElementSelector>;

  /** Version of this mapping file (for tracking changes) */
  version?: string;

  /** Author or team who maintains this file */
  author?: string;

  /** Last updated timestamp (ISO 8601) */
  lastUpdated?: string;

  /** Tags for categorization */
  tags?: string[];
}

/**
 * Result of attempting to find an element
 */
export interface ElementFindResult {
  /** Whether the element was found */
  found: boolean;

  /** Which selector was successful (primary or which fallback index) */
  usedSelector?: string;

  /** The selector strategy that worked (e.g., "primary", "fallback-0") */
  strategy?: 'primary' | `fallback-${number}`;

  /** Error message if not found */
  error?: string;

  /** Number of elements found (if > 1, might need context) */
  count?: number;

  /** Time taken to find element (ms) */
  duration?: number;
}

/**
 * Health check result for a selector
 */
export interface SelectorHealthResult {
  /** Element key */
  key: string;

  /** Whether the selector is healthy */
  healthy: boolean;

  /** Which selector worked */
  workingSelector?: string;

  /** Which strategy worked */
  workingStrategy?: 'primary' | `fallback-${number}`;

  /** Warning messages */
  warnings?: string[];

  /** Error message if unhealthy */
  error?: string;

  /** Number of elements found */
  count?: number;

  /** Suggestions for improvement */
  suggestions?: string[];
}

/**
 * Complete health report for a page's selectors
 */
export interface PageHealthReport {
  /** Page identifier */
  page: string;

  /** Total number of selectors checked */
  total: number;

  /** Number of healthy selectors */
  healthy: number;

  /** Number of unhealthy selectors */
  unhealthy: number;

  /** Number of selectors with warnings */
  warnings: number;

  /** Individual selector results */
  results: SelectorHealthResult[];

  /** Overall health percentage (0-100) */
  healthPercentage: number;

  /** Timestamp of this check */
  timestamp: string;
}

/**
 * Options for finding elements
 */
export interface FindElementOptions {
  /** Timeout in milliseconds */
  timeout?: number;

  /** Whether element must be visible */
  mustBeVisible?: boolean;

  /** Whether element must be enabled */
  mustBeEnabled?: boolean;

  /** Whether to wait for element to be stable */
  waitForStable?: boolean;

  /** Maximum number of retries */
  maxRetries?: number;

  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Selector repository configuration
 */
export interface SelectorRepositoryConfig {
  /** Base directory for selector files */
  selectorDir?: string;

  /** Whether to enable caching */
  enableCache?: boolean;

  /** Cache TTL in milliseconds */
  cacheTTL?: number;

  /** Whether to enable strict validation */
  strictValidation?: boolean;

  /** Whether to log selector usage statistics */
  enableStats?: boolean;
}
