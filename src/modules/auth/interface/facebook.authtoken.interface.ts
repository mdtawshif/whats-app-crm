/**
 * {
        "access_token": "EAAOYuQYI3TABPFclTHx04bWbKu0x8LFspo*****",
        "token_type": "bearer",
        "expires_in": 5183896
    }
 */
export interface FacebookAuthTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}
