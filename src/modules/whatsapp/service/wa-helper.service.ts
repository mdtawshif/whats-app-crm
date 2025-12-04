import { addTimeToCurrent, freshToken, getDateDifference } from "@/common/wa-helper/wa-helper";
import { Injectable } from "@nestjs/common";
import { ProductType } from "@prisma/client";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";

@Injectable()
export class WaHelperService {
    constructor(
        private readonly prisma: PrismaService,
        @InjectPinoLogger(WaHelperService.name)
        private readonly logger: PinoLogger,
    ) {}

    async getWithRefreshToken(userId: bigint, activeOnly: boolean  = false) {
        try{
            const where = {
                userId: userId,
                productType: ProductType.WHATS_APP
            };
            if(activeOnly){
                where['isRevoked'] = false
            }
            const tokenRes = await this.prisma.metaOauthToken.findFirst({
                where: where,
                select: {
                    accessToken: true,
                    expiredAt: true,
                    isRevoked: true,
                    revokedAt: true,
                    id: true,
                    profileData: true,
                    agencyId: true
                }
            })
            if(tokenRes){
                if(tokenRes.isRevoked){
                    return {
                        token: null,
                        message: 'Your access token has been revoked. Please connect with meta again'
                    };
                }

                if(tokenRes.profileData){
                    const profileData = JSON.parse(tokenRes.profileData);
                    if(!profileData.version || profileData.version !== "v2"){
                        return {
                            token: null,
                            message: 'Our signup configuration process has been changed. Please signup again !!!'
                        };
                    }
                }
                else{
                    return {
                        token: null,
                        message: 'No profile data found from last signup. Please try again !!!'
                    };
                }

                /* check difference */
                if(getDateDifference(tokenRes.expiredAt as unknown as string) < 1){
                    /* token revoked */
                    await this.prisma.metaOauthToken.update({
                        where: { id: tokenRes.id },
                        data: { isRevoked: true, revokedAt: new Date()},
                    })
                    return {
                        token: null,
                        message: 'Your access token has been revoked. Please connect with meta again'
                    };
                }
                if(getDateDifference(tokenRes.expiredAt as unknown as string) < 5){
                    /* refresh token */
                    const response = await freshToken(tokenRes.accessToken);
                    if(response.status === 200){
                        const updateResponse = await this.prisma.metaOauthToken.update({
                            where: { id: tokenRes.id },
                            data: { 
                                accessToken: response.data.access_token, 
                                isRevoked: false,
                                expiredAt: new Date(addTimeToCurrent(response.data.expires_in)),
                            },
                        })
                        if(updateResponse){
                            return {
                                token: response.data.access_token,
                                message: 'New token generated'
                            };
                        }
                    }
                    await this.prisma.metaOauthToken.update({
                        where: { id: tokenRes.id },
                        data: { isRevoked: true, revokedAt: new Date()},
                    })
                }
                
                return {
                    token: tokenRes.accessToken,
                    message: 'Get access token',
                    profileData: JSON.parse(tokenRes.profileData),
                    agencyId: tokenRes.agencyId,
                    // teamId: tokenRes.teamId
                };
            }
            return {
                token: null,
                message: 'No access token found ! Please connect with meta again.'
            };
        }
        catch(e){
            this.logger.error(e)
            return {
                token: null,
                message: 'Something went wrong !'
            };
        }
    }

    async getWithRefreshTokenById(id: bigint) {
        try{
            const tokenRes = await this.prisma.metaOauthToken.findFirst({
                where: { id: id },
                select: {
                    accessToken: true,
                    expiredAt: true,
                    isRevoked: true,
                    revokedAt: true,
                    id: true,
                    profileData: true,
                    agencyId: true,
                    // teamId: true,
                }
            })
            if(tokenRes){
                if(tokenRes.isRevoked){
                    return {
                        token: null,
                        message: 'Your access token has been revoked. Please connect with meta again'
                    };
                }

                if(tokenRes.profileData){
                    const profileData = JSON.parse(tokenRes.profileData);
                    if(!profileData.version || profileData.version !== "v2"){
                        return {
                            token: null,
                            message: 'Our signup configuration process has been changed. Please signup again !!!'
                        };
                    }
                }
                else{
                    return {
                        token: null,
                        message: 'No profile data found from last signup. Please try again !!!'
                    };
                }

                /* check difference */
                if(getDateDifference(tokenRes.expiredAt as unknown as string) < 1){
                    /* token revoked */
                    await this.prisma.metaOauthToken.update({
                        where: { id: tokenRes.id },
                        data: { isRevoked: true, revokedAt: new Date()},
                    })
                    return {
                        token: null,
                        message: 'Your access token has been revoked. Please connect with meta again'
                    };
                }
                if(getDateDifference(tokenRes.expiredAt as unknown as string) < 5){
                    /* refresh token */
                    const response = await freshToken(tokenRes.accessToken);
                    if(response.status === 200){
                        const updateResponse = await this.prisma.metaOauthToken.update({
                            where: { id: tokenRes.id },
                            data: { 
                                accessToken: response.data.access_token, 
                                isRevoked: false,
                                expiredAt: new Date(addTimeToCurrent(response.data.expires_in)),
                            },
                        })
                        if(updateResponse){
                            return {
                                token: response.data.access_token,
                                message: 'New token generated'
                            };
                        }
                    }
                    await this.prisma.metaOauthToken.update({
                        where: { id: tokenRes.id },
                        data: { isRevoked: true, revokedAt: new Date()},
                    })
                }
                
                return {
                    token: tokenRes.accessToken,
                    message: 'Get access token',
                    profileData: JSON.parse(tokenRes.profileData),
                    agencyId: tokenRes.agencyId,
                    // teamId: tokenRes.teamId
                };
            }
            return {
                token: null,
                message: 'No access token found ! Please connect with meta again.'
            };
        }
        catch(e){
            this.logger.error(e)
            return {
                token: null,
                message: 'Something went wrong !'
            };
        }
    }
}