import { SsoProvider } from '@prisma/client';
import { FacebookAuthTokenResponse } from '../interface/facebook.authtoken.interface';
import axios from 'axios';
import { FACEBOOK_AUTH_BASE_URL } from '@/config/constant';

export class FacebookOAuthFetcher {
  async fetchTokenWithGrant(
    code: string,
    ssoProvider: SsoProvider,
  ): Promise<FacebookAuthTokenResponse | null> {
    let response = null;
    try {
      response = await axios.get(FACEBOOK_AUTH_BASE_URL, {
        params: {
          client_id: ssoProvider.clientId,
          client_secret: ssoProvider.clientSecret,
          code: code,
          redirect_uri: ssoProvider.redirectUrl,
        },
      });
    } catch {
      return null;
    }

    if (response.data.code >= 200 && response.data.code < 300) {
      return {
        accessToken: response.data.access_token,
        tokenType: response.data.token_type,
        expiresIn: response.data.expires_in,
      };
    }

    return null;
  }
}
