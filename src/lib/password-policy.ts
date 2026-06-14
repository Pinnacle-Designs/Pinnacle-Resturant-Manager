/** NIST SP 800-63B–aligned bounds for memorized secrets. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

const BLOCKED_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "demo1234",
  "12345678",
  "123456789",
  "qwerty123",
  "admin123",
  "letmein",
  "welcome1",
  "pinnacle",
  "restaurant",
  "changeme",
]);

export function validatePassword(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters`;
  }
  if (BLOCKED_PASSWORDS.has(password.toLowerCase())) {
    return "Choose a stronger password that is not commonly used";
  }
  return null;
}
