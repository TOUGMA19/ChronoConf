/**
 * Frontend security utilities
 * Sanitization, validation, and XSS protection
 */

// Strip HTML tags to prevent XSS
export function sanitizeText(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

// Clean text input: trim + limit length (no HTML encoding, for internal use)
export function cleanInput(input: string, maxLength: number = 500): string {
  return input.trim().slice(0, maxLength);
}

// Validate that a string contains only safe characters (no script injection)
export function isSafeText(input: string): boolean {
  const dangerousPatterns = [
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:\s*text\/html/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<form/i,
  ];
  return !dangerousPatterns.some((p) => p.test(input));
}

// Sanitize input for safe storage: clean + validate
export function secureTrim(input: string, maxLength: number = 500): string {
  let cleaned = input.trim().slice(0, maxLength);
  // Remove null bytes
  cleaned = cleaned.replace(/\0/g, "");
  // Remove control characters except newlines and tabs
  cleaned = cleaned.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned;
}

// Validate duration
export function validateDuration(value: string | number, min = 5, max = 480): number {
  const num = typeof value === "string" ? parseInt(value, 10) : value;
  if (isNaN(num) || num < min) return min;
  if (num > max) return max;
  return num;
}

// Validate time format HH:mm
export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

// Validate CSV file size (max 5MB)
export const MAX_CSV_SIZE = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 2000;

// Input field max lengths
export const LIMITS = {
  title: 300,
  authors: 500,
  moderator: 200,
  sessionChair: 200,
  abstract: 5000,
  category: 100,
  speaker: 200,
  description: 1000,
  conferenceName: 200,
  roomName: 100,
} as const;
