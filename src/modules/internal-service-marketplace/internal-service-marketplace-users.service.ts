import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type MarketplaceUserSummary = {
  id: string;
  displayName: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  countryCode: string | null;
};

@Injectable()
export class InternalServiceMarketplaceUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async summaries(userIds: string[]): Promise<{ users: MarketplaceUserSummary[] }> {
    const rows = await this.prisma.user.findMany({
      where: { id: { in: userIds }, disabled: false },
      select: {
        id: true,
        displayName: true,
        fullName: true,
        email: true,
        phone: true,
        countryCode: true,
      },
    });
    const users = rows.map((r) => ({
      id: r.id,
      displayName: r.displayName ?? null,
      fullName: r.fullName ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      countryCode: r.countryCode ?? null,
    }));
    return { users };
  }
}
