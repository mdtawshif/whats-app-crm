
export class BroadcastMessageLogDTO{
  agencyId: bigint;
  userId: bigint;
  teamId?: bigint;
  contactId: bigint;
  broadcastId: bigint;
  broadcastSettingId?: bigint;
  waBusinessAccountId?: bigint;
  fbBusinessId?: bigint;
  waBusinessNumberId?: bigint;
  message?: string;
  messagingProduct?: string; 
  messageType?: string;      
  response?: any;
  errorMessage?: string;
  status?: string;          
  lastMessageAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  messageSid?:string;
  accountSid?:string
}