import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import { RabbitmqService } from './rabbitmq.service';
import { SessionService } from '../../modules/auth/session.service';
import { UsersService } from '../../modules/users/users.service';
import { InternalAdminKycReviewService } from '../../modules/internal-admin/internal-admin-kyc-review.service';
import { InternalAdminPersonalKycService } from '../../modules/internal-admin/internal-admin-personal-kyc.service';
import { InternalAdminVerificationsService } from '../../modules/internal-admin/internal-admin-verifications.service';
import { InternalServiceMarketplaceUsersService } from '../../modules/internal-service-marketplace/internal-service-marketplace-users.service';

@Injectable()
export class RabbitmqRpcConsumer implements OnModuleInit {
  private readonly logger = new Logger(RabbitmqRpcConsumer.name);

  constructor(
    private readonly rabbit: RabbitmqService,
    private readonly session: SessionService,
    private readonly users: UsersService,
    private readonly kycReview: InternalAdminKycReviewService,
    private readonly personalKyc: InternalAdminPersonalKycService,
    private readonly verifications: InternalAdminVerificationsService,
    private readonly marketplaceUsers: InternalServiceMarketplaceUsersService,
  ) {}

  async onModuleInit() {
    await this.rabbit.consumeRpc(
      'user-service.rpc',
      [
        'user.rpc.session.resolve',
        'user.rpc.user.search',
        'user.rpc.user.currency-country',
        'user.rpc.professionals.search',
        'user.rpc.kyc.personal.status',
        'user.rpc.admin.kyc.professional.list',
        'user.rpc.admin.kyc.professional.get',
        'user.rpc.admin.kyc.professional.approve',
        'user.rpc.admin.kyc.professional.reject',
        'user.rpc.admin.kyc.personal.list-pending',
        'user.rpc.admin.kyc.personal.get',
        'user.rpc.admin.kyc.personal.approve',
        'user.rpc.admin.kyc.personal.reject',
        'user.rpc.admin.verifications.list',
        'user.rpc.marketplace.user.summaries',
        'user.rpc.push-tokens.list',
      ],
      async (routingKey, body) => {
        const b = body as Record<string, unknown>;

        switch (routingKey) {
          case 'user.rpc.session.resolve': {
            return this.session.resolveAuthenticatedSession(
              b.authorization as string | undefined,
              b.deviceId as string | undefined,
            );
          }

          case 'user.rpc.user.search': {
            try {
              return await this.users.searchByEmailOrPhone(b.query as string);
            } catch (e) {
              if (e instanceof NotFoundException) return null;
              throw e;
            }
          }

          case 'user.rpc.user.currency-country': {
            return this.users.currencyCountryForUser(b.userId as string | undefined);
          }

          case 'user.rpc.professionals.search': {
            return this.users.searchApprovedProfessionals(
              b.role as string | undefined,
              b.query as string | undefined,
            );
          }

          case 'user.rpc.kyc.personal.status': {
            return this.users.personalKycStatus(b.userId as string | undefined);
          }

          case 'user.rpc.admin.kyc.professional.list': {
            return this.kycReview.listApplications();
          }

          case 'user.rpc.admin.kyc.professional.get': {
            return this.kycReview.getApplicationDetail(b.id as string);
          }

          case 'user.rpc.admin.kyc.professional.approve': {
            return this.kycReview.approve(b.id as string);
          }

          case 'user.rpc.admin.kyc.professional.reject': {
            return this.kycReview.reject(
              b.id as string,
              b.reason as string | undefined,
            );
          }

          case 'user.rpc.admin.kyc.personal.list-pending': {
            return this.personalKyc.listPending();
          }

          case 'user.rpc.admin.kyc.personal.get': {
            return this.personalKyc.getUserDetail(b.userId as string);
          }

          case 'user.rpc.admin.kyc.personal.approve': {
            return this.personalKyc.approve(b.userId as string);
          }

          case 'user.rpc.admin.kyc.personal.reject': {
            return this.personalKyc.reject(
              b.userId as string,
              b.reason as string | undefined,
            );
          }

          case 'user.rpc.admin.verifications.list': {
            return this.verifications.list(b.limit as number | undefined);
          }

          case 'user.rpc.marketplace.user.summaries': {
            return this.marketplaceUsers.summaries(b.userIds as string[]);
          }

          case 'user.rpc.push-tokens.list': {
            return this.users.listPushTokensForUser(b.userId as string | undefined);
          }

          default:
            this.logger.warn(`Unknown RPC routing key: ${routingKey}`);
            throw new Error(`Unknown RPC routing key: ${routingKey}`);
        }
      },
    );
  }
}
