import { Injectable, Logger } from '@nestjs/common';

/**
 * Outbound email — wire SMTP/SES/etc. here. Verification codes are never returned from API routes.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationEmail(to: string, _code: string): Promise<void> {
    void _code;
    this.logger.log(
      JSON.stringify({
        event: 'email_send_stub',
        to,
        note: 'provider not configured',
      }),
    );
  }
}
