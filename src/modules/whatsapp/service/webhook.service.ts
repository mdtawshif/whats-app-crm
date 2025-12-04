import { Injectable } from '@nestjs/common';
import { Gateway, WebhookProcessStatus } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger()
    private readonly logger: PinoLogger,
  ) { }

  async addNewEventRecord(raw_data: any) {
    return this.prisma.webhookDataProcess.create({
      data: {
        rawData: raw_data,
        status: WebhookProcessStatus.QUEUE
      }
    })
  }

  async webhookDataProcessCron() {
    /* get data from  webhookDataProcess table by status queue */
    const list = await this.prisma.webhookDataProcess.findMany({
      where: {
        status: WebhookProcessStatus.QUEUE,
        gateway: { in: [Gateway.WhatsApp, Gateway.Other] },
      },
      select: {
        id: true,
        rawData: true,
      },
      skip: 0,
      take: 50
    })

    if (list.length > 0) {
      for (const item of list) {
        try {
          /* update status to processing */
          await this.prisma.webhookDataProcess.update({
            where: {
              id: item.id
            },
            data: {
              status: WebhookProcessStatus.PROCESSING
            }
          })
          const webhookObject = item.rawData['object'];
          if (webhookObject === "whatsapp_business_account") {
            const entry = item.rawData['entry'];
            if (entry && Array.isArray(entry) && entry.length > 0) {
              for (const eachEntry of entry) {
                const changes = eachEntry['changes'];
                if (changes && Array.isArray(changes) && changes.length > 0) {
                  for (const eachChanges of changes) {
                    /* main property: value, field */
                    if (eachChanges['field'] === "message_template_status_update") {
                      this.messageTemplateProcess(eachChanges['value'], eachChanges['field'])
                    }
                    if (eachChanges['field'] === "template_category_update") {
                      this.messageTemplateProcess(eachChanges['value'], eachChanges['field'])
                    }
                    if (eachChanges['field'] === "messages") {
                      this.sendMessages(eachChanges['value'], eachChanges['field'])
                    }
                  }
                }
              }
            }
          }
          /* make more if condition is needed */

          await this.prisma.webhookDataProcess.update({
            where: {
              id: item.id
            },
            data: {
              status: WebhookProcessStatus.PROCESSED
            }
          })
        }
        catch (e) {
          console.log("==================webhookDataProcessCron==================", JSON.stringify(e), item.id)
          await this.prisma.webhookDataProcess.update({
            where: {
              id: item.id
            },
            data: {
              status: WebhookProcessStatus.FAILED,
              errorMessage: typeof e === "string" ? e : JSON.stringify(e)
            }
          })
        }
      }
    }
  }


  /* private method */
  private async messageTemplateProcess(
    value: any,
    type: "message_template_status_update" | "template_category_update"
  ) {

    switch (type) {
      case "message_template_status_update":
        await this.prisma.messageTemplate.updateMany({
          where: {
            messageId: `${value['message_template_id']}`
          },
          data: {
            status: value['event']
          }
        });
        break;

      case "template_category_update":
        await this.prisma.messageTemplate.updateMany({
          where: {
            messageId: `${value['message_template_id']}`
          },
          data: {
            category: value['new_category']
          }
        });
        break;
      default:
        console.log("Unknown type from messageTemplateProcess", type);
    }
  }

  private async sendMessages(
    value: any,
    type: "messages"
  ) {

    console.log(value, type)
    /* 
    "messaging_product": "whatsapp",
    "metadata": {
      "display_phone_number": "16505551111",
      "phone_number_id": "123456123"
    },
    "contacts": [
      {
        "profile": {
          "name": "test user name"
        },
        "wa_id": "16315551181"
      }
    ],
    "messages": [
      {
        "from": "16315551181",
        "id": "ABGGFlA5Fpa",
        "timestamp": "1504902988",
        "type": "text",
        "text": {
          "body": "this is a text message"
        }
      }
    ]
    */
  }
}