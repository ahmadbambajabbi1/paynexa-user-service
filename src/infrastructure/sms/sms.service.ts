import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import twilio from 'twilio';

/**
 * Sends OTP via Twilio. Requires env vars (see `.env.example`); no dev bypass.
 */
@Injectable()
export class SmsService {
  async sendVerificationCode(e164Phone: string, code: string): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const from =
      process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() ??
      process.env.TWILIO_FROM_NUMBER?.trim();
    if (!accountSid || !authToken || !from) {
      throw new ServiceUnavailableException(
        'SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID.',
      );
    }
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      to: e164Phone,
      from,
      body: `Your SafeTrade verification code is ${code}. It expires in 10 minutes.`,
    });
  }
}
