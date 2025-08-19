import { ParsedEmailAddress } from '@/types';

/**
 * Extract name and email address from a full email string
 * Examples:
 * - "John Doe <john@example.com>" -> { name: "John Doe", email: "john@example.com" }
 * - "john@example.com" -> { name: "john", email: "john@example.com" }
 */
export function extractNameFromEmail(fullEmail: string): ParsedEmailAddress {
  const match = fullEmail.match(/^(.*?)\s*<(.+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: fullEmail.split('@')[0], email: fullEmail };
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Format date in human-readable format
 */
export function formatDate(dateString: string | Date): string {
  const date =
    typeof dateString === 'string' ? new Date(dateString) : dateString;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
