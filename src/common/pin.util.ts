import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';

const PIN_RE = /^\d{4}$/;

export function assertValidPin(pin: string): void {
  if (!PIN_RE.test(pin.trim())) {
    throw new BadRequestException('PIN must be exactly 4 digits');
  }
}

export function hashPin(pin: string): string {
  return createHash('sha256').update(pin.trim(), 'utf8').digest('hex');
}
