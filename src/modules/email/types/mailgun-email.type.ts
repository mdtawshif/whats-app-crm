import { Models } from 'postmark';

export interface EmailParams {
  from: string;
  to: string;
  subject: string;
  body: string;
  auth: {
    host?: string;
    port?: number;
    userName?: string;
    password?: string;
    secure?: boolean;
    api_key?: string;
    sender_address?: string;
  };
  // attachments?: {
  //   Name: string;
  //   Content: string;
  //   ContentType: string;
  //   ContentID: string;
  // }[];
  attachments?: Models.Attachment[]; //  Fix: Use Postmark's type
}
