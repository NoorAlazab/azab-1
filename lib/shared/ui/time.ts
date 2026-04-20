/**
 * Time formatting utilities for consistent date/time display
 */

/**
 * Format a date relative to now (e.g., "2 minutes ago", "3 days ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Future dates
  if (diffInSeconds < 0) {
    return "just now";
  }

  // Less than a minute
  if (diffInSeconds < 60) {
    return "just now";
  }

  // Less than an hour
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  // Less than a day
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  // Less than a week
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  // Less than a month (30 days)
  if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  // More than a month - show actual date
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format expiry countdown (e.g., "expires in 2 hours", "expired 3 days ago")
 */
export function formatExpiryCountdown(expiryDate: Date): {
  text: string;
  status: "active" | "warning" | "expired";
} {
  const now = new Date();
  const diffInMs = expiryDate.getTime() - now.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);

  // Already expired
  if (diffInSeconds <= 0) {
    const expiredAgo = formatRelativeTime(expiryDate);
    return {
      text: `Expired ${expiredAgo}`,
      status: "expired",
    };
  }

  // Less than an hour - warning
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return {
      text: `Expires in ${minutes} minute${minutes === 1 ? "" : "s"}`,
      status: "warning",
    };
  }

  // Less than a day - warning if < 6 hours
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return {
      text: `Expires in ${hours} hour${hours === 1 ? "" : "s"}`,
      status: hours < 6 ? "warning" : "active",
    };
  }

  // Less than a week
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return {
      text: `Expires in ${days} day${days === 1 ? "" : "s"}`,
      status: "active",
    };
  }

  // More than a week - show date
  return {
    text: `Expires ${expiryDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: expiryDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    })}`,
    status: "active",
  };
}

/**
 * Format a timestamp for display in tables/lists
 */
export function formatTimestamp(date: Date): string {
  const now = new Date();
  const isToday = 
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  // This year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  // Different year
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}