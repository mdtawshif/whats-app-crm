import { GrantType } from '@/common/enums/grand.type';
import { Headers } from '@nestjs/common';
import { SsoProvider } from '@prisma/client';
import { GoogleAuthTokenResponse } from '../interface/google.authtoken.interface';

export class GoogleOauthFetcher {
  async fetchTokenWithGrant(
    codeOrToken: string,
    ssoProvider: SsoProvider,
    grantType: GrantType,
  ): Promise<GoogleAuthTokenResponse | null> {
    const axios = require('axios');
    const qs = require('qs');
    const googleTokenUrl = 'https://oauth2.googleapis.com/token';
    const grant =
      grantType === GrantType.AUTHORIZATION_CODE
        ? 'authorization_code'
        : 'refresh_token';

    const payload = {
      client_id: ssoProvider.clientId,
      client_secret: ssoProvider.clientSecret,
      redirect_uri: ssoProvider.redirectUrl,
      grant_type: grant,
      ...(grantType === GrantType.AUTHORIZATION_CODE
        ? { code: codeOrToken }
        : { refresh_token: codeOrToken }),
    };

    try {
      console.log('Sending token request:', payload);
      const tokenResponse = await axios.post(googleTokenUrl, qs.stringify(payload), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      console.log('Token response:', JSON.stringify(tokenResponse.data, null, 2));

      if (tokenResponse?.data?.access_token) {
        return {
          accessToken: tokenResponse.data.access_token,
          refreshToken: tokenResponse.data.refresh_token,
          tokenType: tokenResponse.data.token_type,
          expiresIn: tokenResponse.data.expires_in,
          scope: tokenResponse.data.scope,
          idToken: tokenResponse.data.id_token,
        };
      }
      return null;
    } catch (error) {
      console.log("error", error);
      console.error('Google token fetch failed:', error?.response?.data || error);
      return null;
    }
  }
  // google.oauth.fetcher.ts
  async fetchWithAuth(url: string, accessToken: string): Promise<Response> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response;
  }

  async fetchGoogleContacts(accessToken: string): Promise<any[]> {
    try {
      const url =
        'https://people.googleapis.com/v1/people/me/connections' +
        '?personFields=names,emailAddresses,phoneNumbers';

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`Google Contacts fetch failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.connections || [];
    } catch (error) {
      console.error('Failed to fetch Google contacts:', error);
      return [];
    }
  }
}
