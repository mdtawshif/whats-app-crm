import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { addMinutes } from 'date-fns';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { getBaseTemplate } from '../common/html/template';

@Injectable()
export class VerificationCodeService {
  constructor(
    private prisma: PrismaService,
    @InjectPinoLogger(VerificationCodeService.name)
    private readonly logger: PinoLogger,
  ) {}

  async generateOTP(length: number = 6): Promise<string> {
    const buffer = await randomBytes(Math.ceil(length / 2));
    const OTP = buffer.toString('hex').toUpperCase().slice(0, length);
    return OTP;
  }

  generatePassword(length: number): string {
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_-+=';
    const password = [];
    const charsetLength = charset.length;
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charsetLength);
      password.push(charset[randomIndex]);
    }
    return password.join('').trim();
  }

  async getForgetPasswordEmailTemplate(otp, name, logo) {
    const body =
      '<h1>Reset Password</h1>\n' +
      `        <h2>Hello ${name}</h2>\n` +
      '        <p>Please enter the following OTP to reset your password.</p>\n' +
      `        <b> ${otp}</b>\n` +
      '        </div>';
    return getBaseTemplate(body, logo);
  }

  async getVerificationEmailTemplate(otp, name, logo) {
    const body =
      '<h1>Email Confirmation</h1>\n' +
      `        <h2>Hello ${name}</h2>\n` +
      '        <p>Thank you for subscribing. Please enter the following OTP to confirm your email.</p>\n' +
      `        <b> ${otp}</b>\n` +
      '        </div>';
    return getBaseTemplate(body, logo);
  }

  async getRegisterConfirmEmailTemplate(name, logo) {
    const body =
      '<h1>Email Confirmation</h1>\n' +
      `        <h2>Hello ${name}</h2>\n` +
      '        <p>Thank you for registration. Please login your account.</p>\n' +
      '        </div>';
    return getBaseTemplate(body, logo);
  }

  async getUserInvitationEmailTemplate(
    name,
    username,
    password,
    workspaceName,
    logo,
    loginUrl = 'https://app.superlocalfans.com/login',
    email = 'contract@superlocalfans.com',
  ) {
    if (!password) {
      const body =
        `<h1>You're Invited to ${workspaceName}!</h1>\n` +
        `        <p>Hello, ${name || username}</p>\n` +
        `        <p>You have invited you to join ${workspaceName}.</p>\n` +
        '        <p>Thank you!</p>\n';
      return getBaseTemplate(body, logo);
    }

    const body =
      `<h1>Welcome to ${workspaceName}!</h1>\n` +
      `        <h2>Hello ${username}</h2>\n` +
      `        <p>Your account has been successfully created for ${workspaceName}. Here are your login details:</p>\n` +
      `        <p><b>Username:</b> ${username}</p>\n` +
      `        <p><b>Password:</b> ${password}</p>\n` +
      `        <p>You can log in to ${workspaceName} using the following link:</p>\n` +
      `        <p><a href="${loginUrl}">${loginUrl}</a></p>\n` +
      `        <p>If you have any questions or need assistance, please contact us at ${email}.</p>\n` +
      '        <p>Thank you!</p>\n';
    return getBaseTemplate(body, logo);
  }
}
