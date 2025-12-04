import { Injectable } from '@nestjs/common'
import { BroadcastContactEntryQueue, EntryStatus } from '@prisma/client'
import { PrismaService } from 'nestjs-prisma'
import { take } from 'rxjs'

@Injectable()
export class BroadcastContactEntryService {
  constructor(private readonly prisma: PrismaService) {}

  
}
