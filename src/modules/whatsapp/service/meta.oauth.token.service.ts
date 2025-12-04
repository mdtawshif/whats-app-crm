import { Injectable } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import { PrismaService } from 'nestjs-prisma';
import { LoginUser } from 'src/modules/auth/dto/login-user.dto';
import { AccessTokenResponse } from '../interface/waba.integration.interface';
import { addTimeToCurrent } from '@/common/wa-helper/wa-helper';

@Injectable()
export class MetaOAuthTokenService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async codeToAccessTokenManage(user: LoginUser, token: AccessTokenResponse, fbUserData: any){
    const existingToken = await this.prisma.metaOauthToken.findFirst({where: { userId: user.id }});
    if(existingToken){
        /* update  */
        const res = await this.prisma.metaOauthToken.update({
            where: {id: existingToken.id},
            data: {
              expiredAt: new Date(addTimeToCurrent(token.expires_in)), //new Date(token.expires_in),
              accessToken: token.access_token,
              profileData: JSON.stringify(fbUserData)
            }
        })
        if(res){
          return res.id;
        }
    }
    else{
        /* create new one */
        const res = await this.prisma.metaOauthToken.create({
            data: {
                expiredAt: new Date(addTimeToCurrent(token.expires_in)), //new Date(token.expires_in),
                accessToken: token.access_token,
                productType: ProductType.WHATS_APP,
                agencyId: user.agencyId,
                userId: user.id,
                profileData: JSON.stringify(fbUserData)
            }
        })
        if(res){
          return res.id;
        }
    }
    return null
  }

  async findOauthTokenByUserAndProductType(
    userId: bigint,
    metaProductType: ProductType,
  ) {
    return await this.prisma.metaOauthToken.findFirst({
      where: { userId: userId, productType: metaProductType },
      select: {
        isRevoked: true,
        profileData: true,
        tokenType: true
      },
      orderBy: {
        id: "desc"
      }
    });
  }

  async findUserAccessToken(
    userId: bigint,
    metaProductType: ProductType,
  ) {
    return await this.prisma.metaOauthToken.findFirst({
      where: { userId: userId, productType: metaProductType },
      select: {
        accessToken: true,
        expiredAt: true
      }
    });
  }

  async disconnectMeta(id: bigint){
    await this.prisma.metaOauthToken.update({
      where: {
        id: id
      },
      data: {
        isRevoked: true,
        revokedAt: new Date()
      }
    })
  }
}
