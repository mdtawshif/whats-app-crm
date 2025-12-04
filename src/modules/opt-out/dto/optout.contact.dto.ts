
export interface OptOutContactDTO {
  userId: bigint;
  agencyId: bigint;
  contactId: bigint;
  reason?: string | null;
}