import { CreateAgencyDto } from '@/modules/agency/dto/create-agency-dto';
import { UserDto } from '@/modules/auth/dto/user-request-dto';
import { CreateFollowUpDataDto } from '@/modules/follow-up/dto/create-follow-up.dto';
import { UpdateFollowUpDataDto } from '@/modules/follow-up/dto/update-follow-up.dto';
import {
  ADD_USER_INFO_DTO,
  user_infos_show_appointment_url,
  user_infos_show_signature,
  user_infos_two_factor_authentication_email,
  user_infos_two_factor_authentication_sms,
  user_infos_two_factor_authentication_status,
} from '@/modules/user-info/dto/add-user-info.dto';
import { generateUid } from '@/utils/converter';

export const baseUserData: Partial<UserDto> = {
  id: BigInt(1),
  workspace_id: BigInt(1),
  team_id: BigInt(1),
};

export const planData = {
  id: BigInt(1),
  uid: generateUid(),
  title: 'User Plan 1',
  package_price: 100,
  status: 'ACTIVE',
  billing_cycle: 1,
  credit_carry_forward: true,
  subscription_button_text: 'Subscribe',
  visibility: 'SHOW',
  package_features: [],
  view_features: [],
  package_discounts: [],
  pricing: {},
  created_at: new Date(),
  updated_at: new Date(),
};

export const createAgencyDto: CreateAgencyDto = {
  title: 'Test Agency',
  privacy_policy_url: 'http://example.com/privacy',
  term_and_condition_url: 'http://example.com/terms',
  about_page_url: 'http://example.com/about',
  domain_prefix: 'test',
  custom_domain: 'test.com',
  logo: 'logo.png',
  fav_icon: 'favicon.ico',
  can_user_register: 'YES',
  auto_recurring: 'ACTIVE',
  user_registration: 'ENABLE',
  onboarding_status: 'ON',
  onboarding_stage_no: 1,
};

export const agencyInfo = {
  currency: 'USD',
  logo: 'logo.png',
  fav_icon: 'favicon.ico',
  title: 'Test Agency',
  domain_prefix: 'test',
  custom_domain: 'test.com',
  payment_method: 'paypal',
};
export const updateFollowUpDataDto: UpdateFollowUpDataDto = {
  uid: '1234567890abcdef',
  campaign_uid: 'abcdef1234567890',
  title: 'Updated Follow Up Title',
  day: 2,
  hour: '14:00',
  message_subject: 'Updated Subject',
  message_body: 'Updated Body',
  type: 'SCHEDULE',
};
export const baseUserInfo: ADD_USER_INFO_DTO = {
  timezone: 'GMT',
  signature: 'signature',
  show_signature: user_infos_show_signature.YES,
  two_factor_authentication_status:
    user_infos_two_factor_authentication_status.ON,
  two_factor_authentication_sms: user_infos_two_factor_authentication_sms.ON,
  two_factor_authentication_email:
    user_infos_two_factor_authentication_email.ON,
  appointment_url: 'http://example.com/appointment',
  show_appointment_url: user_infos_show_appointment_url.YES,
  custom_domain: 'example.com',
  brand_name: 'Brand Name',
  theme: 'Theme',
  brand_logo: 'logo.png',
  brand_url: 'http://example.com/brand',
  fav_icon: 'icon.png',
};

export const followUpInfoData: CreateFollowUpDataDto = {
  campaign_uid: '6BCE529F13EB4912AFC8B27C995E9E3A',
  title: 'Follow-up title',
  day: 1,
  hour: '2',
  fixed_date: '2024-01-01',
  message_subject: 'Subject',
  message_body: 'Body',
  message_type: 'EMAIL',
  type: 'IMMEDIATE',
};
