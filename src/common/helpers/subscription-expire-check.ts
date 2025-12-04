import { UserDto } from '@/modules/auth/dto/user-request-dto';
import { returnError } from './response-handler.helper';

export const hasSubscription = (user: UserDto) => {
  if (!user.has_package) {
    return returnError(400, 'PURCHASE_OR_UPDATE_PACKAGE');
  }
  return true;
};
