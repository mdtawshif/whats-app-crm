import { forwardRef, Module } from '@nestjs/common';
import { InboxThreadService } from './inbox-thread.service';
import { InboxThreadController } from './inbox-thread.controller';
import { PrismaModule } from 'nestjs-prisma';
import { TriggerModule } from '../trigger/trigger.module';

@Module({
  imports: [PrismaModule, forwardRef(() => TriggerModule)],
  controllers: [InboxThreadController],
  providers: [InboxThreadService],
  exports: [InboxThreadService],
})
export class InboxThreadModule { }
