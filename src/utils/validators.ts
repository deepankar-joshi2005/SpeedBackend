export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MOBILE_REGEX = /^[6-9]\d{9}$/;
// At least 6 characters, one uppercase, one lowercase, one number.
export const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;

export const isValidEmail = (email: string): boolean => EMAIL_REGEX.test(email.trim());

export const isValidMobile = (mobile: string): boolean => MOBILE_REGEX.test(mobile.trim());

export const isStrongPassword = (password: string): boolean =>
  STRONG_PASSWORD_REGEX.test(password);
