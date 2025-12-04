export type UserCardInfo = {
  id: bigint;
  user_id: bigint;
  team_id: bigint | null;
  card_number: string;
  token: string | null;
  customer_id: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED' | 'TRIALING';
  created_at: Date;
  updated_at: Date;
  card_brand: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
};
