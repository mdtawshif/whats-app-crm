import { TOKEN_TYPE__ACCESS, TOKEN_TYPE__REFRESH } from '@/config/constant';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { addDays, addHours } from 'date-fns';
import jwt from 'jsonwebtoken';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import {
  returnError,
  returnSuccess,
} from '../../common/helpers/response-handler.helper';
import { LoginUser, UserToken } from './dto/login-user.dto';

const tokenTypes = {
  ACCESS: TOKEN_TYPE__ACCESS,
  REFRESH: TOKEN_TYPE__REFRESH,
  RESET_PASSWORD: 'resetPassword',
  VERIFY_EMAIL: 'verifyEmail',
};

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectPinoLogger(TokenService.name)
    private readonly logger: PinoLogger,
  ) { }

  generateToken(
    uuid: string,
    expires: Date,
    type: any,
    secret: string,
  ): string {
    const payload = {
      sub: uuid,
      /// commenting for testing
      // iat: Math.floor(Date.now() / 1000), 
      // exp: Math.floor(expires.getTime() / 1000), 
      type,
    };

    this.logger.info(`Generated token for user ${uuid}: ${JSON.stringify(payload)}`);

    return jwt.sign(payload, secret, { expiresIn: "30d" });
  }


  async verifyToken(token: string, type: any): Promise<any> {
    try {
      await jwt.verify(token, process.env.JWT_SECRET);
      const tokenDoc = await this.prisma.token.findFirst({
        where: {
          token,
        },
        select: {
          id: true,
          userId: true,
          // workspace_id: true,
          type: true,
          blacklisted: true,
        },
      });

      if (!tokenDoc) {
        this.logger.error(`Token not found for type ${type}`);
        return false;
      }

      if (tokenDoc.type !== type || tokenDoc.blacklisted === true) {
        return false;
      }

      return tokenDoc;
    } catch (error) {
      this.logger.error(`Error verifying token for type ${type}: ${error}`);
      console.log(`Error verifying token for type ${type}: ${error}`);
      return false;
    }
  }

  async generateAccessTokenFromRefreshToken(
    refreshToken: string,
  ): Promise<any> {
    try {
      if (!refreshToken || refreshToken === '') {
        this.logger.warn(`Refresh token not found.`);
        return null;
      }
      const decoded: any = jwt.verify(refreshToken, process.env.JWT_SECRET);

      if (decoded.type !== tokenTypes.REFRESH) {
        this.logger.warn(`Token type mismatch. Expected REFRESH.`);
        return null;
      }

      const tokenDoc = await this.prisma.token.findFirst({
        where: {
          token: refreshToken,
          type: tokenTypes.REFRESH,
          blacklisted: false,
        },
      });

      if (!tokenDoc) {
        this.logger.warn(`Refresh token not found or blacklisted.`);
        return null;
      }

      const accessTokenExpires = addHours(
        new Date(),
        this.configService.get<number>('app.jwtAccessExpirationHours'),
      );

      const newAccessToken = this.generateToken(
        tokenDoc?.userId.toString(),
        accessTokenExpires,
        tokenTypes.ACCESS,
        process.env.JWT_SECRET,
      );

      // Save the new access token in the DB
      await this.prisma.token.create({
        data: {
          token: newAccessToken,
          userId: tokenDoc?.userId,
          type: tokenTypes.ACCESS,
          expires: accessTokenExpires,
          blacklisted: false,
        },
      });

      return {
        token: newAccessToken,
        expires: accessTokenExpires,
      };

    } catch (error) {
      this.logger.error(
        `Error in generateAccessTokenFromRefreshToken: ${error}`,
      );
      return null;
    }
  }

  // not used 27-06-2024
  //   async saveToken(
  //     token: string,
  //     userId: number,
  //     expires: Date,
  //     type: any,
  //     blacklisted = false
  //   ): Promise<any> {
  //     return this.prisma.tokens.create({
  //       data: {
  //         token,
  //         userId: userId,
  //         expires,
  //         type,
  //         blacklisted,
  //       }
  //     });
  //   }

  async createMultipleTokens(tokens: any[]): Promise<any> {
    return await this.prisma.token.createMany({
      data: tokens,
    });
  }

  async removeTokenById(id: number): Promise<void> {
    await this.prisma.token.delete({
      where: {
        id,
      },
    });
  }

  async refreshUserAuthTokens(userId: bigint): Promise<UserToken> {

    const currentDate = new Date();
    const accessTokenExpires = addHours(
      currentDate,
      this.configService.get<number>('app.jwtAccessExpirationHours'),
    );

    const accessToken = this.generateToken(
      userId.toString(),
      accessTokenExpires,
      tokenTypes.ACCESS,
      process.env.JWT_SECRET,
    );

    const refreshTokenExpires = addDays(
      currentDate,
      this.configService.get<number>('app.jwtRefreshExpirationDays'),
    );

    const refreshToken = this.generateToken(
      userId.toString(),
      refreshTokenExpires,
      tokenTypes.REFRESH,
      process.env.JWT_SECRET,
    );

    const tokens = [
      {
        token: accessToken,
        userId: Number(userId),
        type: tokenTypes.ACCESS,
        expires: accessTokenExpires,
        blacklisted: false,
      },
      {
        token: refreshToken,
        userId: Number(userId),
        type: tokenTypes.REFRESH,
        expires: refreshTokenExpires,
        blacklisted: false,
      },
    ];

    await this.prisma.token.deleteMany({
      where: {
        userId: Number(userId)
      },
    });

    await this.createMultipleTokens(tokens);

    let userToken: UserToken = new UserToken();
    userToken.userId = userId;

    userToken.access = {
      token: accessToken,
      expires: accessTokenExpires,
    };

    userToken.refresh = {
      token: refreshToken,
      expires: refreshTokenExpires,
    };

    return userToken;

  }

  async createAndDeleteAuthTokens(loggedInUser: LoginUser): Promise<LoginUser> {

    const currentDate = new Date();
    const accessTokenExpires = addHours(
      currentDate,
      this.configService.get<number>('app.jwtAccessExpirationHours'),
    );




    const accessToken = this.generateToken(
      loggedInUser.id.toString(),
      accessTokenExpires,
      tokenTypes.ACCESS,
      process.env.JWT_SECRET,
    );

    const refreshTokenExpires = addDays(
      currentDate,
      this.configService.get<number>('app.jwtRefreshExpirationDays'),
    );

    const refreshToken = this.generateToken(
      loggedInUser.id.toString(),
      refreshTokenExpires,
      tokenTypes.REFRESH,
      process.env.JWT_SECRET,
    );


    const tokens = [
      {
        token: accessToken,
        userId: Number(loggedInUser.id),
        type: tokenTypes.ACCESS,
        expires: accessTokenExpires,
        blacklisted: false,
      },
      {
        token: refreshToken,
        userId: Number(loggedInUser.id),
        type: tokenTypes.REFRESH,
        expires: refreshTokenExpires,
        blacklisted: false,
      },
    ];

    await this.prisma.token.deleteMany({
      where: {
        userId: loggedInUser.id
      },
    });

    await this.createMultipleTokens(tokens);

    loggedInUser.access = {
      token: accessToken,
      expires: accessTokenExpires,
    };

    loggedInUser.refresh = {
      token: refreshToken,
      expires: refreshTokenExpires,
    };

    return loggedInUser;

  }

}
