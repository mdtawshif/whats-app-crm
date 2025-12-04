export interface WhatsappMessageActionContact {
    id: bigint;

    number: string;
    firstName: string;
    lastName: string;
    email: string;
}

export interface WhatsappMessageActionConfigData {
    message?: string;
    recipient?: string[];
    sender_number?: string;
    mediaUrl?: string;
    template?: string;
    receiver_type?: string;
    receiver_number?: string;
}

export enum ReceiverType {
  USER = "user",
  CONTACT = "contact",
  NUMBER = "number"
}