import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';

import {
  returnError,
  returnSuccess,
} from '../../common/helpers/response-handler.helper';
import { TokenService } from './token.service';
import { LoginUser, LoginUserDto } from './dto/login-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { hashPasswordDto, registerUserDto } from './dto/register-user.dto';
import { UserService } from '../user/user.service';
import { generateRandomPassword } from '@/common/custom/generate-password';
import { LoggedInUser } from '../user/dto/user.dto';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { VerificationCodeService } from './verification.service';
import {
  AgencyStatus,
  Prisma,
  ProviderType,
  UserStatus,
  IsMailVerified,
  UserPackageStatus,
} from '@prisma/client';
import { SsoProviderService } from './service/ssoprovider.service';
import { randomBytes } from 'crypto';
import { VerifyVerificationCodeDto } from './dto/verify-mail.dto';

import { PermissionUtil } from '../../utils/permission-util';
import { ApiKeyUtils } from '@/utils/api-key-generator';
import { RoleDTO } from '../../utils/RoleDTO';
import { DEFAULT_AGENCY_NAME } from '../../utils/global-constant';
import { on } from 'events';
import { UserTimezone } from '@/common/decorator/timezone.decorator';
import { getPublicIP } from '@/utils/utils';
import requestCountry from 'request-country';
interface UserResponseData {
  oldToken?: {
    userId: number;
  };
  // Add other properties as needed
}
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationCodeService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly ssoProviderService: SsoProviderService,
    @InjectPinoLogger(AuthService.name)
    private readonly logger: PinoLogger,
  ) { }

  async registerNewuser(registerUser: registerUserDto, userTimezone: UserTimezone) {
    try {
      /**
       * check if email already exists
       */
      const existingUser = await this.prisma.user.findFirst({
        where: { email: registerUser.email },
      });

      if (existingUser) {
        throw new UnauthorizedException("Email already exists");
      }

      const role = await this.getRole(RoleDTO.ADMIN_ROLE_NAME);
      const agency = await this.getAgency(DEFAULT_AGENCY_NAME);

      const password = registerUser.password;

      const user = await this.prisma.user.create({
        data: {
          agencyId: agency.id,
          email: registerUser.email,
          password: await this.hashPassword(registerUser),
          rawPassword: password,
          userName: registerUser.user_name || null,
          currentCredit: 0,
          roleId: role.id,
          status: UserStatus.ACTIVE,
          apiKey: ApiKeyUtils.generateApiKey(),
          rolePermissionMask: role.permissionMask,
          addedPermissionMask: '0',
          removedPermissionMask: '0',
          timeZone: userTimezone.timezone,
        },
      });

      delete user.password;
      delete user.rawPassword;

      return {
        success: true,
        message: 'User registered successfully',
        user: user,
        responseCode: 201,
      };
    } catch (error) {
      this.logger.error(error);
      return returnError(500, error?.message || 'Failed to register user');
    }
  }

  /**
 * Retrieves a role by name from the database. If the role does not exist,
 * it creates a new role with default values.
 * If the role exists, it can update values if needed.
 * @param roleName - The name of the role to retrieve or create.
 * @returns The existing or newly created/updated role object.
 */
  private async getRole(roleName: string) {
    return await this.prisma.role.findFirst({
      where: { name: roleName },
    });
  }


  /**
   * Retrieves an agency by name from the database. If the agency does not exist,
   * it creates a new agency with default values.
   * @param agencyName - The name of the agency to retrieve or create.
   * @returns The existing or newly created agency object.
   */
  private async getAgency(agencyName: string) {
    let agency = await this.prisma.agency.findFirst({
      where: { name: agencyName },
    });

    return agency
      ? agency
      : await this.prisma.agency.create({
        data: {
          name: agencyName,
          status: AgencyStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
  }

  async login(loginUserDto: LoginUserDto) {
    try {

      let loggedInUser = await this.findActiveUserByEmailAndPassword(loginUserDto);

      if (!loggedInUser) {
        return returnError(400, 'USER_LOGIN_FAILED');
      }


      loggedInUser = await this.tokenService.createAndDeleteAuthTokens(loggedInUser);

      if (loggedInUser && loggedInUser.status && loggedInUser.status == UserStatus.PENDING) {
        await this.prisma.user.update({
          where: {
            id: loggedInUser.id
          },
          data: {
            status: UserStatus.NEED_TO_RESET_CREDENTIAL
          }
        });
        loggedInUser.status = UserStatus.NEED_TO_RESET_CREDENTIAL;
      }

      return returnSuccess(200, 'USER_LOGIN_SUCCESS', loggedInUser);

    } catch (error) {
      this.logger.error(error);
      return returnError(400, error?.message || 'USER_LOGIN_FAILED');
    }
  }


  async findActiveUserByEmailAndPassword(user: LoginUserDto): Promise<LoginUser> {
    console.log("login user input data", user);

    let where: Prisma.UserWhereInput = {
      email: user.email,
      status: { in: [UserStatus.ACTIVE, UserStatus.PENDING, UserStatus.NEED_TO_RESET_CREDENTIAL] }
    };

    const userData = await this.prisma.user.findFirst({
      where,
      select: {
        id: true,
        status: true,
        email: true,
        password: true,
        parentUserId: true,
        agencyId: true,
        currentCredit: true,
        userName: true,
        roleId: true,
        rolePermissionMask: true,
        addedPermissionMask: true,
        removedPermissionMask: true,
        isMailVerified: true
      },
    });

    if (!userData || userData.password === null) {
      throw new UnauthorizedException("INVALID_USERNAME_OR_PASSWORD");
    }

    const isPasswordValid = await bcrypt.compare(
      user.password,
      userData.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("INVALID_USERNAME_OR_PASSWORD");
    }

    // if parentUserId is null, set it to user id (self reference)
    if (!userData.parentUserId) {
      userData.parentUserId = userData.id;
    }

    // remove password field
    const { password, ...safeUser } = userData;

    const userPackageData = await this.prisma.userPackage.findFirst({
      where: {
        userId: userData.id,
        status: { in: [UserPackageStatus.ACTIVE, UserPackageStatus.TRIALING] },
      },
      select: {
        id: true
      }
    });

    let roleName: string = null;

    if (userData.roleId) {
      const role = await this.prisma.role.findFirst({
        where: {
          id: userData.roleId
        },
        select: {
          name: true
        }
      });
      if (role) {
        roleName = role.name;
      }
    }

    // map to LoginUser DTO
    const loginUser: LoginUser = {
      ...safeUser,
      currentCredit: safeUser.currentCredit.toNumber(), // convert Decimal -> number
      access: null,
      refresh: null,
      packageId: userPackageData?.id ?? null, // safe null check
      roleName: roleName,
      rolePermissionMask: BigInt(safeUser.rolePermissionMask),
      addedPermissionMask: BigInt(safeUser.addedPermissionMask),
      removedPermissionMask: BigInt(safeUser.removedPermissionMask)
    } as LoginUser;

    loginUser.permissions = await PermissionUtil.getPermissions(loginUser);

    return loginUser;

  }

  /**
   * Find user by user id
   * @param userId 
   * @returns 
   */

  async findUserByUserId(userId: bigint) {
    try {
      if (!userId) return returnError(400, 'USER_NOT_FOUND');
      const userData = await this.prisma.user.findFirst({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          password: true,
          parentUserId: true,
          currentCredit: true,
          userName: true,
          status: true,
          roleId: true,
        },
      });

      // if parentUserId is null, set it to user id (self reference)
      if (!userData.parentUserId) {
        userData.parentUserId = userData.id;
      }

      if (!userData) return returnError(400, 'USER_NOT_FOUND');
      return returnSuccess(200, 'USER_FOUND', userData);
    } catch (error) {
      this.logger.error(error);
      return returnError(500, error?.message || 'USER_LOGIN_FAILED');

    }
  }
  /**
   *  Find user by email
   * @param email 
   * @returns 
   */

  async findUserByUserEmail(email: string) {
    try {
      if (!email) return returnError(400, 'USER_NOT_FOUND');
      const userData = await this.prisma.user.findFirst({
        where: { email },
        select: {
          id: true,
          email: true,
          password: true,
          parentUserId: true,
          currentCredit: true,
          userName: true,
          status: true,
          roleId: true,
        },
      });
      // if parentUserId is null, set it to user id (self reference)
      if (!userData.parentUserId) {
        userData.parentUserId = userData.id;
      }
      if (!userData) return returnError(400, 'USER_NOT_FOUND');
      return returnSuccess(200, 'USER_FOUND', userData);
    } catch (error) {
      this.logger.error(error);
      return returnError(500, error?.message || 'USER_LOGIN_FAILED');

    }
  }

  async hashPassword(dto: hashPasswordDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return hashedPassword;
  }

  async changePassword(
    loggedUser: LoginUser,
    changePasswordDto: ChangePasswordDto,
    headers: any,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: loggedUser.id,
        OR: [
          // { status: 'NEED_TO_RESET_CREDENTIAL' },
          { status: 'ACTIVE' },
        ],
      },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      return returnError(404, 'USERS_NOT_FOUND');
    }
    const { old_password, new_password } = changePasswordDto;

    const isPasswordValid = await bcrypt.compare(old_password, user.password);

    if (!isPasswordValid) {
      return returnError(400, 'WRONG_OLD_PASSWORD');
    }
    if (old_password === new_password) {
      return returnError(400, 'PLEASE_ENTER_NEW_PASSWORD');
    }

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: await bcrypt.hash(new_password, 8),
        rawPassword: new_password,
        status: 'ACTIVE',
      },
    });

    const [type, token] = headers.authorization?.split(' ') ?? [];
    this.removeAllLoginUserSessions(user.id, token);

    return returnSuccess(200, 'PASSWORD_UPDATED_SUCCESS');
  }

  async removeAllLoginUserSessions(userId: bigint, token: any) {
    await this.prisma.token.deleteMany({
      where: {
        userId: userId,
        token: { not: token },
      },
    });
  }

  async sendResetLink(email: string) {
    const user = await this.prisma.user.findFirst({ where: { email } });
    if (!user) throw new NotFoundException('No user found with this email');

    const tempPassword = generateRandomPassword();
    console.log('Generated Password:', tempPassword);

    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // const emailSendSuccess = await this.emailService.sendEmail({
    //   to: user.email,
    //   subject: 'Password Reset Request!',
    //   body: `
    //   <p>Hello ${user.userName},</p>
    //   <p>Your new login password is: <strong>${tempPassword}</strong></p>
    //   <p>
    //     <a href=${process.env.LOGIN_URL} target="_blank" style="display:inline-block;padding:10px 15px;background:#0052cc;color:white;text-decoration:none;border-radius:4px;">
    //       Log In to Your Account
    //     </a>
    //   </p>
    //   <br/>
    //   <p>Best regards,</p>
    //   <p>${process.env.COMPANY_NAME}</p>
    // `,
    //   user_id: BigInt(user.id),
    // });

    // console.log('emailSendSuccess:', emailSendSuccess);

    // if (emailSendSuccess) {
    //   const updatedUser = await this.prisma.user.update({
    //     where: { id: user.id },
    //     data: {
    //       password: hashedPassword,
    //       rawPassword: tempPassword,
    //     },
    //   });
    //   console.log('updatedUser:', updatedUser);
    // }

    return returnSuccess(200, 'Reset password has been sent to your email');
  }

  async getGoogleAuthUrl() {
    const ssoProvider = await this.ssoProviderService.findSsoProviderByProviderAndRedirectUrl(
      ProviderType.GOOGLE,
      '/auth/google/callback',
    );
    console.log('ssoProvider: .............', ssoProvider);

    const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const url = `${googleAuthUrl}?client_id=${ssoProvider.clientId}&redirect_uri=${ssoProvider.redirectUrl}&response_type=code&scope=openid%20email%20profile`;
    return url;
  }

  async getFacebookAuthUrl(state: string) {
    const ssoProvider = await this.ssoProviderService.findSsoProviderByProvider(
      ProviderType.FACEBOOK,
    );
    const facebookAuthUrl = 'https://www.facebook.com/v20.0/dialog/oauth';
    const url = `${facebookAuthUrl}?client_id=${ssoProvider.clientId}&redirect_uri=${ssoProvider.redirectUrl}&response_type=code&scope=business_management,whatsapp_business_management,whatsapp_business_messaging,public_profile,email&state=${state}`;
    return url;
  }

  async sendVerificationCode(user: LoginUser) {
    const userData = await this.prisma.user.findUnique({
      where: {
        id: user.id,
        email: user.email,
        status: 'ACTIVE',
        isMailVerified: IsMailVerified.NO,
      },
      select: {
        id: true,
        userName: true,
        email: true,
      },
    });

    const teamInfo = await this.prisma.team.findFirst({
      where: {
        ownerId: user.id
      },
      select: {
        id: true
      }
    })

    if (!userData) {
      return returnError(404, 'USERS_NOT_FOUND');
    }

    const verificationCode = await this.generateOTP(6);
    console.log('verificationCode', verificationCode);

    const emailSendSuccess = true;
    await this.emailService.sendEmailWithOutVerification({
      to: user.email,
      subject: 'Verification Code',
      body: `
      <p>Hello ${userData.userName} ,</p>
      <p>Your verification code is: <strong>${verificationCode}</strong></p>
      <br/>
      <p>Best regards,</p>
      <p>${process.env.COMPANY_NAME}</p>
    `,
      user_id: BigInt(user.parentUserId ?? user.id),
      // team_id: teamInfo.id || null,
    });

    console.log('emailSendSuccess', emailSendSuccess);

    if (emailSendSuccess) {
      const existingToken = await this.prisma.token.findFirst({
        where: {
          userId: user.id,
          type: 'VERIFICATION_CODE',
        },
      });

      const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      if (existingToken) {
        const updatedToken = await this.prisma.token.update({
          where: { id: existingToken.id },
          data: {
            token: verificationCode,
            expires: expiryDate,
            blacklisted: false,
          },
        });
        console.log('updatedToken', updatedToken);
      } else {
        const createdToken = await this.prisma.token.create({
          data: {
            userId: user.id,
            type: 'VERIFICATION_CODE',
            token: verificationCode,
            expires: expiryDate,
            blacklisted: false,
          },
        });
        console.log('createdToken', createdToken);
      }
    }

    return returnSuccess(200, 'Verification code has been sent to your email');
  }

  async verifyVerificationCode(dto: VerifyVerificationCodeDto, user: LoginUser) {
    const tokenData = await this.prisma.token.findFirst({
      where: {
        userId: user.id,
        type: 'VERIFICATION_CODE',
        blacklisted: false,
      },
    });


    if (!tokenData) {
      return returnError(404, 'VERIFICATION_CODE_NOT_FOUND');
    }

    const now = new Date();

    if (tokenData.expires && tokenData.expires < now) {
      return returnError(400, 'VERIFICATION_CODE_EXPIRED');
    }

    if (tokenData.token !== dto.code) {
      return returnError(400, 'WRONG_VERIFICATION_CODE');
    }

    //  Mark user as verified
    await this.prisma.user.update({
      where: {
        id: user.id,
        status: 'ACTIVE',
      },
      data: {
        isMailVerified: IsMailVerified.YES,
      },
    });

    //  Invalidate the token (delete or blacklist)
    await this.prisma.token.update({
      where: {
        id: tokenData.id,
      },
      data: {
        blacklisted: true,
      },
    });
    return returnSuccess(200, 'VERIFICATION_CODE_VERIFIED');
  }

  async generateOTP(length: number = 6): Promise<string> {
    const buffer = await randomBytes(Math.ceil(length / 2));
    const OTP = buffer.toString('hex').toUpperCase().slice(0, length);
    return OTP;
  }

  async registerOrGetUserFromGoogle(googleProfile: {
    email: string;
    name: string;
    picture?: string;
    verifiedEmail?: boolean;
  }, userTimezone?: string) {
    const { email, name, picture, verifiedEmail } = googleProfile;

    // check if user exists
    let user = await this.prisma.user.findFirst({ where: { email } });
    if (user) return user;

    // create new user
    const role = await this.getRole(RoleDTO.ADMIN_ROLE_NAME);
    const agency = await this.getAgency(DEFAULT_AGENCY_NAME);

    const tempPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);


    try {
      user = await this.prisma.user.create({
        data: {
          email,
          userName: name,
          profileUrl: picture || null,
          isMailVerified: 'YES',
          password: hashedPassword,
          rawPassword: tempPassword,
          agencyId: agency.id,
          currentCredit: 0,
          roleId: role.id,
          status: UserStatus.ACTIVE,
          apiKey: ApiKeyUtils.generateApiKey({ prefix: 'sk_', length: 32 }),
          addedPermissionMask: '0',
          removedPermissionMask: '0',
          rolePermissionMask: role.permissionMask,
          timeZone: userTimezone || "UTC",
        },
      });
    } catch (error) {
      console.error('Error creating new google user:', error);

    }
    console.log({ user, agency });


    delete user.password;
    delete user.rawPassword;

    return user;
  }

  async checkOnboarding(userDto: LoggedInUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: userDto.id },
      include: {
        userPackages: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
        },
        metaOauthTokens: {
          where: { productType: 'WHATS_APP' },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid userId provided');
    }

    const emailVerified = user.isMailVerified === 'YES';
    const hasActivePackage = user.userPackages && user.userPackages.length > 0;
    const hasMetaIntegration =
      user.metaOauthTokens && user.metaOauthTokens.length > 0;

    const completedSteps = {
      emailVerification: emailVerified,
      planSelection: hasActivePackage,
      metaIntegration: hasMetaIntegration,
    };

    // onboarding is complete only if all steps are true
    const isOnboarded = Object.values(completedSteps).every(step => step === true);

    return {
      isOnboarded,
      completedSteps,
    };
  }

  // get user country_code
  async getUserCountryCode(req: Request): Promise<{ country_code: string }> {
    try {
      // 1. Get IP
      const ip = await getPublicIP() ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        (req as any).socket.remoteAddress;

      // 2. Lookup country (simple free API example)
      // const res = await fetch("https://api.ipify.org?format=json");
      // const data = await res.json();

      return {
        country_code: requestCountry(ip, "US").toLocaleUpperCase() || "US",
      };
    } catch (err) {
      return { country_code: "US" };
    }
  }

}
