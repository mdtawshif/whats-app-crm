import { EmailProviderInterface } from './email-provider.interface';

export interface SendEmailInterface extends EmailProviderInterface {
  to: string;
  subject: string;
  body: string;
}
