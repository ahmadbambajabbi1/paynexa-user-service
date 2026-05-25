import { BadRequestException } from '@nestjs/common';

/** Normalize to E.164: strip spaces; require + and digits. */
export function normalizePhoneE164(raw: string): string {
  const s = raw.trim().replace(/[\s-]/g, '');
  if (!/^\+\d{8,15}$/.test(s)) {
    throw new BadRequestException(
      'phone must be in international format (e.g. +220XXXXXXXX)',
    );
  }
  return s;
}
