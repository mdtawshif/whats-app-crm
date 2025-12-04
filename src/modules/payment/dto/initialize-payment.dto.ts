import { registerUserDto } from "src/modules/auth/dto/register-user.dto";
import { PaymentConfigDto } from "./get-payment-config.dto";

export class InitializePaymentDto extends PaymentConfigDto {
  total_amount: number;
  service_charge: number;
  amount_without_charge: number;
  title?: string;
  billing_cycle?: number;
  is_life_time?: boolean;
  currency: string;
  description?: string;
  name?: string;
  image_url?: string;
  is_new_user?: string;
  tran_id?: string;
  cus_email?: string;
  cus_name?: string;
  client_id?: string;
  plan_name?:string;
  registrationData?: registerUserDto;
}