import { forwardRef, Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { PrismaModule } from 'nestjs-prisma';
import { InboxThreadModule } from '../inbox-thread/inbox-thread.module';
import { GatewayCredentialService } from '../gateway-provider/gateway.credential.service';
import { SandboxMessageSender } from '../broadcast/broadcast-sender/sandbox.message.sender';
import { UserSettingRepository } from '../broadcast/repository/user.setting.respository';
import { GatewayCredentialRepository } from '../broadcast/repository/gateway.credential.repository';
import { TriggerModule } from '../trigger/trigger.module';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { BroadcastSendLogEntryService } from '../broadcast/broadcast-sender/broadcast.sender.log';
import { WaBusinessNumberService } from '../whatsapp/service/wa.business.number.service';
import { BroadcastSender } from '../broadcast/broadcast-sender/broadcast.sender';

@Module({
  imports: [PrismaModule, InboxThreadModule, forwardRef(() => TriggerModule), BroadcastModule],
  controllers: [ConversationController],
  providers: [ConversationService, UserSettingRepository, WaBusinessNumberService, GatewayCredentialService, SandboxMessageSender,
    GatewayCredentialRepository, BroadcastSendLogEntryService, BroadcastSender
  ],
  exports: [ConversationService]
})
export class ConversationModule { }