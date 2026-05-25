import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';

const ALLOWED_KYC_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

@Injectable()
export class R2KycUploadService {
  private client(): S3Client {
    const endpoint = process.env.R2_ENDPOINT?.trim();
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException(
        'Object storage is not configured (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)',
      );
    }
    return new S3Client({
      region: process.env.R2_REGION?.trim() || 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  private bucket(): string {
    const bucket = process.env.R2_BUCKET?.trim();
    if (!bucket) {
      throw new ServiceUnavailableException('Object storage is not configured (R2_BUCKET)');
    }
    return bucket;
  }

  async uploadKycDocument(input: {
    userId: string;
    buffer: Buffer;
    contentType: string;
    originalName?: string;
  }): Promise<{ key: string }> {
    const ct = (input.contentType || '').toLowerCase();
    if (!ALLOWED_KYC_MIME.has(ct)) {
      throw new BadRequestException('Only JPEG, PNG, WebP, GIF, or PDF files are allowed');
    }
    const ext = safeExt(input.originalName, ct);
    const key = `kyc_uploads/${input.userId}/${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
    try {
      await this.client().send(
        new PutObjectCommand({
          Bucket: this.bucket(),
          Key: key,
          Body: input.buffer,
          ContentType: ct,
        }),
      );
    } catch {
      throw new ServiceUnavailableException(
        'KYC upload is temporarily unavailable. Please try again shortly.',
      );
    }
    return { key };
  }

  /** Time-limited URL for admins to download a private KYC object. */
  async getSignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket(),
      Key: key,
    });
    return getSignedUrl(this.client(), cmd, { expiresIn: expiresInSeconds });
  }
}

function safeExt(filename: string | undefined, contentType: string): string {
  if (filename && /^[a-zA-Z0-9._-]{1,120}$/.test(filename)) {
    const m = filename.toLowerCase().match(/(\.[a-z0-9]{1,8})$/);
    if (m) return m[1];
  }
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/webp') return '.webp';
  if (contentType === 'image/gif') return '.gif';
  if (contentType === 'application/pdf') return '.pdf';
  return '.jpg';
}
