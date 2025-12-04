interface GmailEmailParams {
  from: string;
  to: string;
  subject: string;
  body: string;
  auth: {
    client_id: string;
    secret_key: string;
    client_redirect_uri: string;
  };
  userInfo: {
    refresh_token: string;
    email: string;
  };
}
