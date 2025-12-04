import { MultipartFile } from "@fastify/multipart";
import { LoginUser } from "src/modules/auth/dto/login-user.dto";
import { FastifyRequest } from 'fastify';
import { META_LANGUAGE } from "../constants/meta-timezone.constant";
import { TemplateCategory } from "@prisma/client";
import { ITemplateComponent } from "src/modules/whatsapp/interface/wab.message.template.info.interface";

export interface FastifyRequestWithUser extends FastifyRequest {
  user: LoginUser;
  file: () => Promise<MultipartFile>;
}

export type IUploadMetaImage = {
    token: string;
    fileName: string;
    fileLength: number;
    fileType: string;
    file?: MultipartFile
    buffer?: Buffer<ArrayBufferLike>
}

export type MetaLanguageCode = typeof META_LANGUAGE[keyof typeof META_LANGUAGE];

export interface ICreateMessageTemplate {
  name: string;
  language: MetaLanguageCode;
  category: TemplateCategory;
  components: ITemplateComponent['components']
}

interface ISendMessageBase {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
}

export interface ITextMessage extends ISendMessageBase {
  type: "text";
  text: {
    "preview_url": boolean;
    "body": string;
  }
}