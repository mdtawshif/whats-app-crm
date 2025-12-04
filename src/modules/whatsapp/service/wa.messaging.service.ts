import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { LoginUser } from 'src/modules/auth/dto/login-user.dto';
import { ITextMessage } from '@/common/wa-helper/interface.dt';
import { WaMessagingSendDto } from '../dto/wa-messaging.dto';
import { sendTextMessage } from '@/common/wa-helper/wa-helper';
import { returnError, returnSuccess } from '@/common/helpers/response-handler.helper';
import { HttpStatusCode } from 'axios';
import { WaHelperService } from './wa-helper.service';
import { WaBusinessNumberService } from './wa.business.number.service';
import { ContactService } from 'src/modules/contacts/contact.service';

@Injectable()
export class WaMessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly waHelperService: WaHelperService,
    private readonly waBusinessNumberService: WaBusinessNumberService,
    private readonly contactService: ContactService
  ) { }

  async sendMessage(args: { body: WaMessagingSendDto, user: LoginUser }) {
    const fromNumberData = await this.waBusinessNumberService.getNumberDataById(args.body.fromWaNumber);
    if (!fromNumberData) {
      return returnError(
        HttpStatusCode.BadRequest,
        'From number not found !'
      )
    }

    const accessToken = await this.waHelperService.getWithRefreshTokenById(fromNumberData.metaOauthTokenId)
    if (!accessToken.token) {
      return returnError(
        HttpStatusCode.BadRequest,
        accessToken.message
      )
    }

    const creditInfo = "";
    console.log("creditInfo", creditInfo)

    /* TODO: do it later:  get personalized data and update message */

    let sendResponse = null;
    if (args.body.templateId) {
      /* TODO: do it later : get template information */

    } else if (args.body.message) {
      sendResponse = await this.sendText(fromNumberData.phoneNumberId, "+8801825262557", args.body.message, args.user.id, accessToken.token)
    }

    console.log('sendResponse', sendResponse)



    if (sendResponse.status) {
      return returnSuccess(
        HttpStatusCode.Ok,
        "Text Message sent successfully",
      )
    }
    /* TODO: price: billing_packages */
    /* TODO: store into db table */ /* conversations, inbox_threads */
    /* TODO: reduce credit */ /* users, billing_transactions */

    return returnError(
      HttpStatusCode.BadRequest,
      "Something went wrong !"
    )
  }

  private async sendText(from: string, to: string, message: string, userId: bigint, access_token: string) {
    const finalMessage = await this.messageReplaceWithPersonalized(message, userId)
    const payload: ITextMessage = {
      "messaging_product": "whatsapp",
      "type": "text",
      "recipient_type": "individual",
      "to": to,
      "text": {
        "preview_url": true,
        "body": finalMessage
      }
    }
    return await sendTextMessage(from, access_token, payload)
  }

  private async messageReplaceWithPersonalized(message: string, userId: bigint) {
    console.log("userId", userId)
    return message;
  }
}
