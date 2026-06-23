import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import SentDm from '@sentdm/sentdm';

const DEFAULT_OTP_TEMPLATE_ID = 'c8651540-a1d4-47e7-8f43-fe4d2f745fe6';

/**
 * Sends login OTP via Sent DM authentication template (var_1 = code).
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: SentDm | null = null;

  private getClient(): SentDm {
    if (this.client) return this.client;
    const apiKey = process.env.SENT_DM_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'SMS is not configured. Set SENT_DM_API_KEY.',
      );
    }
    this.client = new SentDm({ apiKey });
    return this.client;
  }

  async sendVerificationCode(e164Phone: string, code: string): Promise<void> {
    const templateId =
      process.env.SENT_DM_OTP_TEMPLATE_ID?.trim() ?? DEFAULT_OTP_TEMPLATE_ID;

    const client = this.getClient();
    try {
      const response = await client.messages.send({
        channel: ['sent'],
        template: {
          id: templateId,
          parameters: {
            var_1: code,
          },
        },
        to: [e164Phone],
      });
      const data = response.data;
      const recipient = data?.recipients?.[0];
      this.logger.log(
        JSON.stringify({
          event: 'sms_sent',
          to: e164Phone,
          messageId: recipient?.message_id,
          status: data?.status,
        }),
      );
    } catch (err) {
      this.logger.error(
        `Sent DM SMS failed for ${e164Phone}`,
        err instanceof Error ? err.stack : String(err),
      );
      if (err instanceof SentDm.APIError) {
        throw new ServiceUnavailableException(
          `SMS delivery failed: ${err.message}`,
        );
      }
      throw new ServiceUnavailableException('SMS delivery failed');
    }
  }
}
