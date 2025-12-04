import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { PrismaService } from 'nestjs-prisma'

@Injectable()
export class BroadcastRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger
  ) {}

  async findBroadcastById(id: bigint) {
    try {
     return await this.prisma.broadcast.findUnique({
        where: {
          id: id
        }
      })
    } catch (error) {
        this.logger.error(error);
    }
  }


  async incrementBroadcast(id: bigint, field: string, incrementBy: number): Promise<boolean> {
        
        if (!id || !field) {
            this.logger.warn('Missing parameters in incrementBroadcastRaw');
            return false;
        }

        const incrementQuery = `UPDATE broadcasts
            SET ${field} = ${field} + ${incrementBy}, updated_at = NOW()
            WHERE id = ${id}`;

        try {
            const totalRowUpdated = await this.prisma.$executeRawUnsafe(incrementQuery);
            return totalRowUpdated > 0;
        } catch (error) {
            this.logger.error(`Failed to increment ${field} for broadcasts ${id}:`);
        }
        return false;
    }

}
