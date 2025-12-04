import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { GoogleUserProfileInfo } from '../interface/googleuser.profile.info.interface';

@Injectable()
export class GoogleUserProfileFetecher {
  constructor(
    @InjectPinoLogger()
    private readonly logger: PinoLogger,
  ) { }

  GOOGLE_USER_PROFILE_INFO_BASE_URL =
    'https://www.googleapis.com/userinfo/v2/me';

  async fetchGoogleUserProfile(
    accessToken: string,
  ): Promise<GoogleUserProfileInfo | null> {
    if (!accessToken) {
      return null;
    }
    let response = null;
    try {
       response = await axios.get(this.GOOGLE_USER_PROFILE_INFO_BASE_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`, // space after Bearer
        },
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          id: response.data.id,
          email: response.data.email,
          verifiedEmail: response.data.verified_email,
          name: response.data.name,
          givenName: response.data.given_name,
          familyName: response.data.family_name,
          picture: response.data.picture,
        };
      }
      return null;
    } catch (error) {
      this.logger.error('Failed to fetch Google user profile:', error?.response?.data || error);
      return null;
    }
  }
}
