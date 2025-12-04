import { Injectable, Logger } from '@nestjs/common';
import { Conversation, ConversationStatus, Gateway, InOut, PricingMessageType, TransactionType, UserPackageStatus, WebhookDataProcess, WebhookDirection, WebhookProcessStatus, MessageType, NotificationType, InboxReadStatus, ConversationMessageType, InboxStatus, type Contact } from '@prisma/client';
import { PrismaService } from 'nestjs-prisma';
import { NotificationService } from '../notifications/notifications.service';
import { InboxThreadService } from '../inbox-thread/inbox-thread.service';
import { TriggerEventManager } from '../trigger/services/trigger-event-manager/trigger-event-manager.service';
import { EventKeys } from 'src/types/triggers';
import { getContactDisplayName } from '@/utils/contact';

@Injectable()
export class TwilioWebhookService {

  private readonly logger = new Logger(TwilioWebhookService.name);

  constructor(private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly inboxThreadService: InboxThreadService,
    private readonly triggerEventManager: TriggerEventManager

  ) { }

  // 1️⃣ Handle incoming WhatsApp/SMS messages
  async handleIncomingMessage(body: any) {

    this.logger.log('Incoming message payload:', body);

    const from = body?.From || '';
    const to = body?.To || '';
    const message = body?.Body || '';

    console.log(`Message from ${from} to ${to}: ${message}`);

    try {
      // Insert into webhook_data_processes
      await this.prisma.webhookDataProcess.create({
        data: {
          rawData: body,                       // JSON payload
          status: WebhookProcessStatus.QUEUE,  // default queue
          gateway: Gateway.Twilio,
          direction: WebhookDirection.INCOMING  // new field
        },
      });

      return {
        status: 'success',
        from,
        to,
        message,
      };

    } catch (error) {
      this.logger.error('Failed to insert webhook data', error);

      return {
        status: 'error',
        error: error.message,
      };
    }

  }

  // 2️⃣ Handle Twilio delivery/read status callback
  async handleStatusCallback(body: any) {

    this.logger.log('Status callback payload:', body);

    const messageSid = body?.MessageSid || '';
    const messageStatus = body?.MessageStatus || '';
    const message = body?.Body || '';
    console.log(`Message SID: ${messageSid} has status: ${messageStatus}`);

    // Example: simulate async DB update

    try {
      // Insert into webhook_data_processes
      await this.prisma.webhookDataProcess.create({
        data: {
          rawData: body,                       // JSON payload
          status: WebhookProcessStatus.QUEUE,  // default queue
          gateway: Gateway.Twilio,             // default value
          direction: WebhookDirection.DLR      // new field
        },
      });

      return {
        status: 'received',
        messageSid,
        messageStatus,
      };

    } catch (error) {

      this.logger.error('Failed to insert webhook data', error);

      return {
        status: 'error',
        error: error.message,
      };

    }

  }

  async webhookDataProcessCronTwilio() {

    const list = await this.prisma.webhookDataProcess.findMany({
      where: {
        status: WebhookProcessStatus.QUEUE,
        gateway: Gateway.Twilio,
      },
      skip: 0,
      take: 50,
    });

    if (list.length === 0) {
      this.logger.log('No Twilio webhook data found in queue.');
      return;
    }

    for (const item of list) {

      try {

        // mark as PROCESSING
        await this.prisma.webhookDataProcess.update({
          where: { id: item.id },
          data: { status: WebhookProcessStatus.PROCESSING },
        });

        const rawData: any = item.rawData;

        const accountSid = rawData?.AccountSid || null;
        const messageSid = rawData?.MessageSid || null;
        const messageStatus = rawData?.MessageStatus || null;
        const toNumber = rawData?.To || null;
        const fromNumber = rawData?.From || null;
        const body = rawData?.Body || null;
        const messageType = rawData?.MessageType || null;

        console.log("accountSid=============", accountSid);
        console.log("messageSid=============", messageSid);

        if (!accountSid || !messageSid) {
          // If either is null/empty → mark as failed
          await this.prisma.webhookDataProcess.update({
            where: { id: item.id },
            data: {
              status: WebhookProcessStatus.FAILED,
              errorMessage: 'Missing AccountSid or MessageSid in webhook data',
            },
          });
          continue;
        }

        await this.prisma.webhookDataProcess.update({
          where: { id: item.id },
          data: {
            accountSid,
            messageSid
          },
        });

        if (item.direction == WebhookDirection.INCOMING && toNumber && fromNumber) {

          const cleanToNumber = toNumber.replace("whatsapp:+", "");
          const cleanFromNumber = fromNumber.replace("whatsapp:+", "");
          console.log(`Cleaned numbers - To: ${cleanToNumber}, From: ${cleanFromNumber}`);


          const params = {
            accountSid,
            messageSid,
            messageStatus,
            cleanToNumber,
            cleanFromNumber,
            body,
            messageType,
          };

          console.log("Found params:", params);

          await this.processIncommingMessage(item, params);

          await this.prisma.webhookDataProcess.update({
            where: { id: item.id },
            data: {
              status: WebhookProcessStatus.PROCESSED,
            },
          });

          continue; // No further processing needed for incoming messages

        }

        const conversation = await this.prisma.conversation.findFirst({
          where: {
            accountSid: accountSid,
            messageSid: messageSid,
          }
        });

        console.log("Found conversation:", conversation);

        if (!conversation) {
          // No matching conversation found → FAILED
          await this.prisma.webhookDataProcess.update({
            where: { id: item.id },
            data: { status: WebhookProcessStatus.FAILED, errorMessage: 'No matching conversation found' },
          });
          continue;
        }


        if (item.direction == WebhookDirection.DLR && messageStatus) {
          await this.processDLR(conversation, item, messageStatus);
        }

        await this.prisma.webhookDataProcess.update({
          where: { id: item.id },
          data: {
            status: WebhookProcessStatus.PROCESSED,
          },
        });


      } catch (e) {
        console.error('Error processing Twilio webhook item', e);
        this.logger.error(
          'Failed to process Twilio webhook item',
          JSON.stringify(e)
        );
        await this.prisma.webhookDataProcess.update({
          where: { id: item.id },
          data: {
            status: WebhookProcessStatus.FAILED,
            errorMessage: typeof e === 'string' ? e : JSON.stringify(e),
          },
        });
      }
    }
  }

  async processDLR(
    conversation: Conversation,
    webhookData: WebhookDataProcess,
    messageStatus: string
  ) {
    const normalizedStatus = messageStatus.trim().toUpperCase();

    switch (normalizedStatus) {
      case "FAILED":
        // Always update to Failed
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: ConversationStatus.FAILED },
        });
        break;

      case "SENT":
        // Only update if current status is Failed or Queue
        if (
          conversation.status === ConversationStatus.FAILED
        ) {
          await this.prisma.conversation.update({
            where: { id: conversation.id },
            data: { status: ConversationStatus.SENT },
          });
        }
        break;

      case "DELIVERED":
        // Only update if current status is NOT Read
        if (conversation.status !== ConversationStatus.READ) {
          await this.prisma.conversation.update({
            where: { id: conversation.id },
            data: { status: ConversationStatus.DELIVERED },
          });
        }
        break;

      case "UNDELIVERED":
        // Always update to Undelivered
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: ConversationStatus.UNDELIVERED },
        });
        break;

      case "READ":
        // Always update to Read
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: ConversationStatus.READ },
        });
        break;

      default:
        console.warn(`Unknown messageStatus: ${messageStatus}`);
    }
  }


  async processIncommingMessage(webhookData: WebhookDataProcess,
    params: {
      accountSid: string | null;
      messageSid: string | null;
      messageStatus: string | null;
      cleanToNumber: string | null;
      cleanFromNumber: string | null;
      body: string | null;
      messageType: string | null;
    }
  ) {

    const waBusinessNumber = await this.prisma.waBusinessNumber.findFirst({
      where: {
        number: {
          in: [params.cleanToNumber, `+${params.cleanToNumber}`]
        }
      }
    });

    console.log("Found waBusinessNumber:", waBusinessNumber);

    if (!waBusinessNumber) {
      console.log(`No business number found for incoming message to ${params.cleanToNumber}`);
      return;
    }

    const contact = await this.prisma.contact.findFirst({
      where: {
        userId: waBusinessNumber.userId,
        number: {
          in: [params.cleanFromNumber, `+${params.cleanFromNumber}`]
        }
      }
    });

    console.log("Found contact:", contact);

    const user = await this.prisma.user.findFirst({
      where: { id: waBusinessNumber.userId },
      select: { id: true, parentUserId: true, agencyId: true, currentCredit: true },
    });

    console.log("Found user:", user);

    if (!user) {
      console.log(`No user found for waBusinessNumber ${waBusinessNumber.id}`);
      return;
    }

    // Check for existing thread to maintain conversation continuity
    const existingThread = await this.prisma.inboxThread.findFirst({
      where: {
        agencyId: user.agencyId,
        userId: user.parentUserId ?? user.id,
        contactId: BigInt(contact.id),
      },
    });


    // Update existing thread
    if (!existingThread) {
      await this.inboxThreadService.createInboxThread({
        agencyId: user.agencyId.toString(),
        userId: user.id.toString(),
        contactId: contact.id.toString(),
        from: params.cleanFromNumber,
        to: params.cleanToNumber,
        messageContent: params.body,
        contentType: ConversationMessageType.TEXT,
        inOut: InOut.IN,
        isRead: InboxReadStatus.UNREAD,
        status: InboxStatus.SUCCESS,
      })
    } else {
      await this.inboxThreadService.updateInboxThread(existingThread?.id?.toString(), {
        contactId: contact.id.toString(),
        agencyId: user.agencyId.toString(),
        userId: user.id.toString(),
        messageContent: params.body,
        lastCommunication: new Date().toISOString(),
        isRead: InboxReadStatus.UNREAD,
        inOut: InOut.IN,
      });
    }




    const parentUserId = user?.parentUserId || user?.id;

    const conversation = await this.prisma.conversation.create({
      data: {
        userId: parentUserId,
        createdBy: user.id,
        agencyId: user.agencyId,
        contactId: contact.id,
        phoneNumberId: waBusinessNumber.phoneNumberId,
        accountSid: params.accountSid,
        messageSid: params.messageSid,
        inOut: InOut.IN,
        messageType: PricingMessageType.TEXT,
        fromNumber: params.cleanFromNumber,
        toNumber: params.cleanToNumber,
        message: params.body,
        status: ConversationStatus.RECEIVED,
      },
    });

    console.log("Found conversation:", conversation);



    // Create trigger event 
    await this.triggerEventManager.createTriggerEventQueue({
      agencyId: user.agencyId,
      userId: user.parentUserId ?? user.id,
      contactId: BigInt(contact.id),
      eventKey: EventKeys.KEYWORD,
      payload: {
        contact: {
          displayName: getContactDisplayName(contact as Contact),
          number: contact.number,
        },
        message: params.body
      },
    });

    //send message to client via websocket
    await this.notificationService.sendToUser(user?.id, user?.agencyId, NotificationType.NEW_MESSAGE, {
      title: "New Message from " + contact.firstName + " " + contact.lastName,
      message: params.body,
      data: {
        id: conversation.id,
        threadId: existingThread?.id,
        agencyId: user?.agencyId,
        userId: parentUserId,
        sender: {
          name: contact.firstName + " " + contact.lastName,
        },
        contactId: contact.id,
        phoneNumberId: waBusinessNumber.phoneNumberId,
        accountSid: params.accountSid,
        messageSid: params.messageSid,
        inOut: InOut.IN,
        messageType: PricingMessageType.TEXT,
        fromNumber: params.cleanFromNumber,
        toNumber: params.cleanToNumber,
        message: params.body,
        status: ConversationStatus.RECEIVED,
        navigatePath: `/inbox`,
      },
    });

    const userPackage = await this.prisma.userPackage.findFirst({
      where: {
        userId: parentUserId,
        status: {
          in: [UserPackageStatus.ACTIVE, UserPackageStatus.TRIALING],
        },
      },
      include: {
        package: true,
      },
    });

    console.log("Found userPackage:", userPackage);

    if (!userPackage) {
      console.log(`No active package found for user ${parentUserId}`);
      return;
    }

    const billingPackageId = userPackage.packageId;

    const pricing = await this.prisma.messagingPricing.findFirst({
      where: {
        packageId: billingPackageId,
        inOut: InOut.IN,
        messageType: PricingMessageType.TEXT,
      },
    });

    console.log("Found pricing:", pricing);

    if (!pricing || !pricing.price) {
      console.log(`No incoming message pricing found for package ${billingPackageId}`);
      return;
    }

    const cost = pricing.price;

    console.log("Found cost:", cost);

    await this.prisma.user.update({
      where: { id: parentUserId },
      data: {
        currentCredit: {
          decrement: cost, // 👈 subtracts cost safely in DB
        },
      },
    });

    await this.prisma.billingTransaction.create({
      data: {
        userId: parentUserId,
        createdBy: user.id,
        agencyId: user.agencyId!,
        type: TransactionType.OUT,
        creditAmount: cost,
        transactionFor: "Incoming Message Cost",
        billingPackageId,
        note: `Cost deducted for incoming message`,
      },
    });

    this.logger.log(`Deducted $${cost} from user ${parentUserId} for incoming message`);

  }

}
