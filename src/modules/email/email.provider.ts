export abstract class EmailProvider {
  abstract sendMail(email: any): void;
  abstract verifyProvider(providerData: any): Promise<boolean>;
}
