import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { FacebookProfileInfo } from '../interface/facebbok.profile.interface';
import axios from 'axios';

@Injectable()
export class FacebookUserProfileFetcher {
  FACEBOOK_USER_PROFILE_INFO_BASE_URL =
    'https://www.googleapis.com/userinfo/v2/me';
  constructor(
    @InjectPinoLogger()
    private readonly logger: PinoLogger,
  ) {}

  async fetchFacebookUserProfile(
    accessToken: string,
  ): Promise<FacebookProfileInfo | null> {
    if (!accessToken) {
      return null;
    }
    let response = null;
    const fields =
      'id,name,email,picture.width(200).height(200),gender,birthday,locale,location';
    try {
      response = await axios.get(this.FACEBOOK_USER_PROFILE_INFO_BASE_URL, {
        params: {
          fields: fields,
          access_token: accessToken,
        },
      });
    } catch {
      return response;
    }

    if (response.data.code >= 200 && response.data.code < 300) {
      return {
        id: response.data.id,
        email: response.data.email,
        name: response.data.name,
        profileUrl: response.data.picture?.data?.url || null,
      };
    }

    return response;
  }
}
