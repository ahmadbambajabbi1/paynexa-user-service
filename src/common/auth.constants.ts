export const OTP_PURPOSE_PHONE_AUTH = 'PHONE_AUTH';
export const OTP_PURPOSE_EMAIL_VERIFY = 'EMAIL_VERIFY';

export const MAX_OTP_ATTEMPTS = 5;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const PREAUTH_TTL_MS = 10 * 60 * 1000;

export type PreAuthFlow = 'set_pin' | 'enter_pin';
