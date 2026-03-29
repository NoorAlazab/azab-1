/**
 * Journey-based navigation types for intelligent page discovery
 *
 * Instead of assuming URL patterns (/login, /users, etc.), the system
 * records HOW to navigate to pages by following user journeys.
 */

import { ElementSelector } from './selectors';

/**
 * A single step in a navigation journey
 */
export interface JourneyStep {
  /** Type of action to perform */
  action: 'navigate' | 'click' | 'hover' | 'wait';

  /** Element to interact with (human-readable, e.g., "Users menu item") */
  target?: string;

  /** CSS selector for the target element */
  targetSelector?: string;

  /** Human-readable description of this step */
  description: string;

  /** URL we expect to arrive at after this step */
  expectedUrl?: string;

  /** Optional timeout in milliseconds */
  timeout?: number;
}

/**
 * Complete journey to reach a specific page
 */
export interface PageJourney {
  /** Keyword identifier for this page (e.g., "users", "settings", "profile") */
  pageKeyword: string;

  /** Actual URL discovered for this page (e.g., "/admin/user-management") */
  actualUrl: string;

  /** URL where the journey begins (typically after login) */
  startingUrl: string;

  /** Sequence of steps to navigate to this page */
  steps: JourneyStep[];

  /** UI element selectors discovered on this page */
  selectors: Record<string, ElementSelector>;

  /** ISO timestamp when this journey was discovered */
  discoveredAt: string;

  /** Environment slug this journey belongs to */
  environmentSlug: string;

  /** Optional: Alternative keywords that could match this page */
  alternativeKeywords?: string[];

  /** Optional: Navigation item text that was clicked to reach this page */
  navigationItemText?: string;
}

/**
 * Complete site map for an environment
 */
export interface SiteMap {
  /** Base URL of the environment */
  environmentUrl: string;

  /** Slug identifier for this environment */
  environmentSlug: string;

  /** Journey for logging into the application */
  loginJourney?: PageJourney;

  /** All discovered pages in the application */
  pages: PageJourney[];

  /** ISO timestamp of last update */
  lastUpdated: string;

  /** Version of the site map schema */
  version: string;
}

/**
 * Request to discover pages after login
 */
export interface DiscoverPagesRequest {
  /** Environment URL to discover */
  environmentUrl: string;

  /** Login credentials */
  credentials: {
    username: string;
    password: string;
  };

  /** Keywords to look for in navigation (from story analysis) */
  targetKeywords?: string[];

  /** Maximum pages to discover */
  maxPages?: number;
}

/**
 * Result of page discovery process
 */
export interface DiscoveryResult {
  /** Successfully discovered pages */
  pages: PageJourney[];

  /** Keywords that were not found in navigation */
  notFound: string[];

  /** Complete site map */
  siteMap: SiteMap;

  /** Any errors encountered during discovery */
  errors?: string[];
}

/**
 * Navigation menu item found during discovery
 */
export interface NavigationItem {
  /** Visible text of the menu item */
  text: string;

  /** CSS selector for this item */
  selector: string;

  /** Keywords extracted from the text */
  keywords: string[];

  /** URL this item links to (if available) */
  href?: string;
}

/**
 * Options for journey execution
 */
export interface JourneyExecutionOptions {
  /** Take screenshots during navigation */
  captureScreenshots?: boolean;

  /** Maximum time to wait for navigation (ms) */
  timeout?: number;

  /** Retry failed steps */
  retryOnFailure?: boolean;

  /** Number of retry attempts */
  maxRetries?: number;
}

/**
 * Result of executing a journey
 */
export interface JourneyExecutionResult {
  /** Whether the journey succeeded */
  success: boolean;

  /** Final URL reached */
  finalUrl: string;

  /** Steps that were executed */
  executedSteps: JourneyStep[];

  /** Any errors encountered */
  error?: string;

  /** Screenshots captured during journey */
  screenshots?: string[];

  /** Time taken to complete journey (ms) */
  duration: number;
}
