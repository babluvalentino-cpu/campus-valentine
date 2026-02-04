// Word Filter utility for chat safety
// Filters profanity and suspicious URLs

const PROFANITY_LIST = [
  // Common English slurs and offensive words
  "badword",
  "offensive",
  // Add more as needed; this is a basic list
];

const PROFANITY_REGEX = new RegExp(`\\b(${PROFANITY_LIST.join("|")})\\b`, "gi");

// URLs that look suspicious (for basic XSS/spam protection)
const SUSPICIOUS_URL_REGEX = /https?:\/\/[^\s]+/gi;

/**
 * Checks if a message contains profanity or suspicious content.
 * Returns { isClean: boolean, warnings: string[] }
 */
export function validateMessageContent(content: string): {
  isClean: boolean;
  warnings: string[];
  cleanContent: string;
} {
  const warnings: string[] = [];
  let cleanContent = content;

  // Check for URLs
  const urlMatches = content.match(SUSPICIOUS_URL_REGEX);
  if (urlMatches && urlMatches.length > 0) {
    warnings.push("Links are not allowed in chat");
    cleanContent = cleanContent.replace(SUSPICIOUS_URL_REGEX, "[LINK REMOVED]");
  }

  // Check for profanity (basic check - can be enhanced)
  if (PROFANITY_REGEX.test(content)) {
    warnings.push("Message contains inappropriate language");
    cleanContent = cleanContent.replace(PROFANITY_REGEX, "***");
  }

  return {
    isClean: warnings.length === 0,
    warnings,
    cleanContent: warnings.length > 0 ? cleanContent : content,
  };
}

/**
 * Sanitizes a message by removing/replacing suspicious content
 */
export function sanitizeMessage(content: string): string {
  let sanitized = content;

  // Replace URLs with placeholder
  sanitized = sanitized.replace(SUSPICIOUS_URL_REGEX, "[LINK REMOVED]");

  // Replace profanity
  sanitized = sanitized.replace(PROFANITY_REGEX, "***");

  return sanitized;
}
