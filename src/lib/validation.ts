/**
 * Shared validation utilities for hire requests, reviews, and other public forms.
 */

export const BLOCKED_DOMAINS = [
  "mailinator.com", "tempmail.com", "throwaway.email", "guerrillamail.com",
  "sharklasers.com", "grr.la", "guerrillamailblock.com", "yopmail.com",
  "fakeinbox.com", "trashmail.com", "dispostable.com", "maildrop.cc",
  "10minutemail.com", "temp-mail.org", "tempail.com",
  // Common test/spam domains
  "test.com", "example.com", "foo.com", "bar.com", "asdf.com",
  "noreply.com", "nowhere.com",
];

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const NAME_REGEX = /^[a-zA-Z\s'-]+$/;
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateName(name: string): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = String(name).trim();
  if (cleaned.length < 2) {
    return { valid: false, cleaned, error: "Name must be at least 2 characters." };
  }
  if (!NAME_REGEX.test(cleaned)) {
    return { valid: false, cleaned, error: "Invalid name. Use letters only." };
  }
  return { valid: true, cleaned };
}

export function validateEmail(email: string): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = String(email).trim().toLowerCase();
  if (!EMAIL_REGEX.test(cleaned)) {
    return { valid: false, cleaned, error: "Invalid email address." };
  }
  const domain = cleaned.split("@")[1];
  if (BLOCKED_DOMAINS.includes(domain)) {
    return { valid: false, cleaned, error: "Disposable or test email addresses are not allowed." };
  }
  if (domain.length < 4 || !domain.includes(".")) {
    return { valid: false, cleaned, error: "Invalid email address." };
  }
  return { valid: true, cleaned };
}

export function validateUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}
