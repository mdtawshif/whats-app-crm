export interface SmtpProviderInterface {
  provider_name: string;
  auth_info: {
    host: string;
    port: string;
    title: string;
    userName: string;
    password: string;
    tag: string;
  };
}
