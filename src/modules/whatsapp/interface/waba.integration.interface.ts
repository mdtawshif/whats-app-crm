import { LoginUser } from "src/modules/auth/dto/login-user.dto";

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface IPersistMetaData {
  user: LoginUser;
  selectedIds: {
    business_management: Array<string>;
    whatsapp_business_management: Array<string>;
  };
  businessData: Array<{id: string; name: string}>;
  whatsAppData: Array<{
    owner_business_info: {
      name: string;
      id: string;
    },
    name: string;
    id: string;
    status: string; //later get from meta document
    timezone_id: number;
    currency: string;
    message_template_namespace: string;
    phones: IWabaPhones;
  }>;
}

export type IWabaPhones = Array<{
  verified_name: string;
  id: string;
  status: string;
  display_phone_number: string
}>
