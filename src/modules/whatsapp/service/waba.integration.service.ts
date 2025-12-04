import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
// import axios from 'axios';
import { IPersistMetaData, IWabaPhones } from '../interface/waba.integration.interface';
import { CodeVerificationStatus, NumberQualityRating, Prisma, WaBusinessStatus, WaNumberStatus } from '@prisma/client';
import { LoginUser } from 'src/modules/auth/dto/login-user.dto';
import { WaHelperService } from './wa-helper.service';
import { deregisterPhoneNumber, registerPhoneNumber, setNewPinPhoneNumber, subscribeWabaApp, unsubscribeWabaApp } from '@/common/wa-helper/wa-helper';

// const {
//   FB_APP_ID,
//   FB_APP_SECRET,
//   GRAPH_VERSION = 'v20.0'
// } = process.env;

@Injectable()
export class WabaIntegrationService {
    constructor(
        private readonly prisma: PrismaService,
        @InjectPinoLogger(WabaIntegrationService.name)
        private readonly logger: PinoLogger,
        private readonly waHelperService: WaHelperService,
    ) {}

    async getOrStoreBusinessAccount(userId: bigint, businessData: {name: string; businessId: string; agencyId: bigint}){
        /* check data is exist */
        const isExist = await this.prisma.fbBusinessAccount.findFirst({
            where: {
                userId: userId, businessId: businessData.businessId
            },
            select: {
                id: true,
                name: true
            }
        })
        if(isExist){
            /* update information */
            await this.prisma.fbBusinessAccount.update({
                where: {id: isExist.id},
                data: {
                    name: businessData.name || isExist.name
                }
            })
            return isExist.id;
        }
        else{
            /* create new */
            const newAccount = await this.prisma.fbBusinessAccount.create({
                data: {
                    businessId: businessData.businessId,
                    name: businessData.name,
                    userId: userId,
                    agencyId: businessData.agencyId,
                }
            })
            if(newAccount){
                return newAccount.id;
            }
        }
        return null;
    }
    async getOrStoreWabaAccount(userId: bigint, businessData: {name: string; wabaId: string; agencyId: bigint; businessId: bigint}){
        /* check data is exist */
        const isExist = await this.prisma.waBusinessAccount.findFirst({
            where: {
                userId: userId, wabaId: businessData.wabaId
            },
            select: {
                id: true,
                name: true
            }
        })
        if(isExist){
            /* update information */
            await this.prisma.waBusinessAccount.update({
                where: {id: isExist.id},
                data: {
                    name: businessData.name || isExist.name,
                    fbBusinessId: businessData.businessId
                }
            })
            return isExist.id;
        }
        else{
            /* create new */
            const newAccount = await this.prisma.waBusinessAccount.create({
                data: {
                    wabaId: businessData.wabaId,
                    name: businessData.name,
                    userId: userId,
                    agencyId: businessData.agencyId,
                    fbBusinessId: businessData.businessId
                }
            })
            if(newAccount){
                return newAccount.id;
            }
        }
        return null;
    }
    async getOrStoreWabaNumber(userId: bigint, data: {
        verified_name: string; 
        code_verification_status: CodeVerificationStatus;
        display_phone_number: string;
        quality_rating: NumberQualityRating;
        number_id: string;
        wabaId: bigint; agencyId: bigint; tokenId: bigint
    }){
        /* check data is exist */
        const isExist = await this.prisma.waBusinessNumber.findFirst({
            where: {
                userId: userId, 
                phoneNumberId: data.number_id
            },
            select: {
                id: true}
        })
        if(isExist){
            /* update information */
            await this.prisma.waBusinessNumber.update({
                where: {id: isExist.id},
                data: {
                    phoneNumberId: data.number_id,
                    verifiedName: data.verified_name,
                    displayPhoneNumber: data.display_phone_number,
                    number: data.display_phone_number.replaceAll(" ", "").replace("+", ""),
                    qualityRating: data.quality_rating,
                    codeVerificationStatus: data.code_verification_status === CodeVerificationStatus.VERIFIED ? CodeVerificationStatus.VERIFIED : CodeVerificationStatus.NOT_VERIFIED,
                    numberStatus: data.code_verification_status === CodeVerificationStatus.VERIFIED ? WaNumberStatus.ACTIVE : WaNumberStatus.INACTIVE
                }
            })
            return isExist.id;
        }
        else{
            /* create new */
            const newAccount = await this.prisma.waBusinessNumber.create({
                data: {
                    userId: userId,
                    agencyId: data.agencyId,
                    phoneNumberId: data.number_id,
                    verifiedName: data.verified_name,
                    displayPhoneNumber: data.display_phone_number,
                    number: data.display_phone_number.replaceAll(" ", "").replace("+", "").replaceAll("-", ""),
                    qualityRating: data.quality_rating,
                    codeVerificationStatus: data.code_verification_status === CodeVerificationStatus.VERIFIED ? CodeVerificationStatus.VERIFIED : CodeVerificationStatus.NOT_VERIFIED,
                    numberStatus: data.code_verification_status === CodeVerificationStatus.VERIFIED ? WaNumberStatus.ACTIVE : WaNumberStatus.INACTIVE,
                    metaOauthTokenId: data.tokenId,
                    waBusinessAccountId: data.wabaId
                }
            })
            if(newAccount){
                return newAccount.id;
            }
        }
        return null;
    }

    async updateWabaForSubscription (id: bigint, flag: boolean = false, status: WaBusinessStatus){
        return await this.prisma.waBusinessAccount.update({
            where:{
                id: id
            },
            data: {
                status: status,
                isAppSubscribed: flag
            }
        })
    }
    async updatePhoneNumberForRegister (id: bigint, flag: boolean = false){
        return await this.prisma.waBusinessNumber.update({
            where:{
                id: id
            },
            data: {
                isRegister: flag
            }
        })
    }
    async getPhoneNumberDetails(id: bigint){
        return await this.prisma.waBusinessNumber.findFirst({
            where:{
                id: id
            },
            select: {
                pinCode: true,
                isRegister: true
            }
        })
    }


    async tryWabaSubscription(wabaId: bigint, userId: bigint){
        const accessToken = await this.waHelperService.getWithRefreshToken(userId, true);
        if(accessToken.token){
            const wabaData = await this.prisma.waBusinessAccount.findFirst({
                where: {
                    id: wabaId
                },
                select: {
                    wabaId: true
                }
            });
            if(wabaData){
                try{
                    /* subscribed app */
                    const makeSubscribed = await subscribeWabaApp(wabaData.wabaId, accessToken.token);
                    if(makeSubscribed){
                        await this.prisma.waBusinessAccount.update({
                            where: {
                                id: wabaId
                            },
                            data: {
                                isAppSubscribed: true
                            }
                        })
                        return {
                            status: true,
                            message: "Subscribe waba account successfully"
                        }
                    }
                    return {
                        status: false,
                        message: "Can not subscribe the waba account"
                    }
                    
                }
                catch(e){
                    console.log("----------4---------", JSON.stringify(e))
                    return {
                        status: false,
                        message: "Can not subscribe the waba account"
                    }
                }
            }
            return {
                status: false,
                message: "No waba data found for this account !"
            }
        }
        return {
            status: false,
            message: accessToken.message
        }
    }
    async tryWabaUnSubscription(wabaId: bigint, userId: bigint){
        const accessToken = await this.waHelperService.getWithRefreshToken(userId, true);
        if(accessToken.token){
            const wabaData = await this.prisma.waBusinessAccount.findFirst({
                where: {
                    id: wabaId
                },
                select: {
                    wabaId: true
                }
            });
            if(wabaData){
                try{
                    /* unsubscribed app */
                    const makeSubscribed = await unsubscribeWabaApp(wabaData.wabaId, accessToken.token);
                    if(makeSubscribed){
                        await this.prisma.waBusinessAccount.update({
                            where: {
                                id: wabaId
                            },
                            data: {
                                isAppSubscribed: false
                            }
                        })
                        return {
                            status: true,
                            message: "Unsubscribe waba account successfully"
                        }
                    }
                    return {
                        status: false,
                        message: "Can not unsubscribe the waba account"
                    }
                    
                }
                catch(e){
                    console.log("----------tryWabaUnSubscription---------", JSON.stringify(e))
                    return {
                        status: false,
                        message: "Can not unsubscribe the waba account"
                    }
                }
            }
            return {
                status: false,
                message: "No waba data found for this account !"
            }
        }
        return {
            status: false,
            message: accessToken.message
        }
    }


    async tryRegisterNumber(numberId: bigint, userId: bigint){
        console.log("userId", userId)
        const numberData = await this.prisma.waBusinessNumber.findFirst({
            where: {
                id: numberId
            },
            select: {
                pinCode: true,
                isRegister: true,
                phoneNumberId: true,
                metaOauthTokenId: true
            }
        });
        if(numberData){
            if(numberData.isRegister){
                return {
                    status: true,
                    message: "Number is already registered !"
                }
            }
            try{
                const accessToken = await this.waHelperService.getWithRefreshTokenById(numberData.metaOauthTokenId);
                if(accessToken.token){
                    try{
                        const setPin = await setNewPinPhoneNumber(numberData.phoneNumberId, accessToken.token, numberData.pinCode);
                        if(setPin){
                            const registerNumber = await registerPhoneNumber(numberData.phoneNumberId, accessToken.token, numberData.pinCode);
                            if(registerNumber){
                                await this.prisma.waBusinessNumber.update({
                                    where: {id: numberId},
                                    data: {
                                        isRegister: true
                                    }
                                })
                                return {
                                    status: true,
                                    message: "Register number successfully"
                                }
                            }
                            return {
                                status: false,
                                message: "Can not register this number"
                            }
                        }
                        return {
                            status: false,
                            message: "Can not set pin to register this number"
                        }
                    }
                    catch(e){
                        console.log("----------tryRegisterNumber---------", JSON.stringify(e))
                        return {
                            status: false,
                            message: "Can not register this number"
                        }
                    }
                }
                return {
                    status: false,
                    message: accessToken.message
                }
            }
            catch(e){
                console.log('----e----', e);
                return {
                    status: false,
                    message: "Can not register this number. Getting issue on authorization"
                }
            }
        }
        return {
            status: false,
            message: "No data found for this number !"
        }
    }
    async tryDeregisterNumber(numberId: bigint, userId: bigint){
        console.log("userId", userId)
        const numberData = await this.prisma.waBusinessNumber.findFirst({
            where: {
                id: numberId
            },
            select: {
                pinCode: true,
                isRegister: true,
                phoneNumberId: true,
                metaOauthTokenId: true
            }
        });
        if(numberData){
            if(!numberData.isRegister){
                return {
                    status: true,
                    message: "Number is already deregistered !"
                }
            }
            try{
                const accessToken = await this.waHelperService.getWithRefreshTokenById(numberData.metaOauthTokenId);
                if(accessToken.token){
                    const deregisterNumber = await deregisterPhoneNumber(numberData.phoneNumberId, accessToken.token);
                    if(deregisterNumber){
                        await this.prisma.waBusinessNumber.update({
                            where: {id: numberId},
                            data: {
                                isRegister: false
                            }
                        })
                        return {
                            status: true,
                            message: "Deregistered number successfully"
                        }
                    }
                    return {
                        status: false,
                        message: "Can not deregistered this number"
                    }
                }
                return {
                    status: false,
                    message: accessToken.message
                }
            }
            catch(e){
                console.log("----------tryDeregisterNumber---------", JSON.stringify(e))
                return {
                    status: false,
                    message: "Can not deregistered this number"
                }
            }
        }
        return {
            status: false,
            message: "No data found for this number !"
        }
    }




    /* old */
    async persistMetaData(args:  IPersistMetaData) {
        try{
            return this.prisma.$transaction(async (tx) => {
                const businessDbInfo = await this.fbBusinessAccountManage({
                    tx,
                    business_management: args.selectedIds.business_management,
                    businessData: args.businessData,
                    user: args.user
                })
                await this.fbWhatsAppBusinessAccountManage({
                    tx,
                    businessDbInfo: businessDbInfo,
                    user: args.user,
                    whatsapp_business_management: args.selectedIds['whatsapp_business_management'],
                    whatsAppData: args.whatsAppData,
                })
                return {ok: true}
            });
        }
        catch(e){
            this.logger.error(e)
            return {ok: false}
        }
    }

    // async refreshMetaAccessToken(userId: bigint) {
    //     try{
    //         const tokenRes = await this.prisma.metaOauthToken.findFirst({
    //             where: { userId, isRevoked: false }
    //         })
    //         if(tokenRes){
    //             const url = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
    //             const params = {
    //                 grant_type: 'fb_exchange_token',
    //                 client_id: FB_APP_ID,
    //                 client_secret: FB_APP_SECRET,
    //                 fb_exchange_token: tokenRes.accessToken
    //             };
    //             const response = await axios.get(url, { params });
    //             if(response.status === 200){
    //                 const updateResponse = await this.prisma.metaOauthToken.update({
    //                     where: { id: tokenRes.id },
    //                     data: { accessToken: response.data.access_token, revokedAt: response.data.expires_in},
    //                 })
    //                 if(updateResponse){
    //                     return {}
    //                 }
    //             }
    //         }
    //         return null;
    //     }
    //     catch(e){
    //         this.logger.error(e)
    //         return null;
    //     }
    // }

    /* private methods */
    /* TODO: need to move this in wa helper service */
    private async fbBusinessAccountManage({
        tx,
        business_management,
        user,
        businessData
    } : {
        tx: Prisma.TransactionClient; 
        business_management: IPersistMetaData['selectedIds']['business_management'];
        user: LoginUser;
        businessData: IPersistMetaData['businessData']
    }){
        const {allDbBizIds, allDbBizObject, deleteArray} = await this.getFbBusinessData(tx, user, business_management, true);
        for(const each in businessData){
            /* for create */
            if(!allDbBizIds.includes(businessData[each].id)){
                const createRes = await tx.fbBusinessAccount.create({
                    data: {
                        userId: user.id,
                        agencyId: user.agencyId,
                        businessId: businessData[each].id,
                        name: businessData[each].name,
                        status: 'ACTIVE'
                    }
                })
                if(createRes){
                    allDbBizObject[`business_${createRes.businessId}`] = {...createRes}
                }
                continue;
            }
            /* for update */
            if(allDbBizIds.includes(businessData[each].id)){
                await tx.fbBusinessAccount.update({
                    where: {
                        id: allDbBizObject[`business_${businessData[each].id}`].id
                    },
                    data: {
                        name: businessData[each].name,
                        status: 'ACTIVE'
                    }
                })
                continue;
            }
        }
        /* for delete or update status */
        /* TODO: update this code based on project business logic */
        if(deleteArray.length > 0){
            await tx.fbBusinessAccount.updateMany({
                where: {
                    id: { in: deleteArray }
                },
                data: {
                    status: 'INACTIVE'
                }
            })
            /* inactive all whatsapp related account  */
            await tx.waBusinessAccount.updateMany({
                where: {
                    userId: user.id,
                    fbBusinessId: {in : deleteArray}
                },
                data: {
                    status: 'INACTIVE'
                }
            })
            const wabaData = await tx.waBusinessAccount.findMany({
                where: {
                    userId: user.id,
                    fbBusinessId: {in : deleteArray},
                    status: 'ACTIVE'
                },
                select: {
                    id: true
                }
            })
            /* inactive all whatsapp related account number  */
            const wabaIds = wabaData.map(each => each.id);
            await tx.waBusinessNumber.updateMany({
                where: {
                    userId: user.id,
                    waBusinessAccountId: {in : wabaIds}
                },
                data: {
                    numberStatus: 'INACTIVE'
                }
            })
        }
        return allDbBizObject;
    }
    private async fbWhatsAppBusinessAccountManage({
        tx,
        user,
        whatsapp_business_management,
        whatsAppData,
        businessDbInfo
    }: {
        tx: Prisma.TransactionClient; 
        user: LoginUser;
        whatsapp_business_management: IPersistMetaData['selectedIds']['whatsapp_business_management'];
        whatsAppData: IPersistMetaData['whatsAppData'];
        businessDbInfo: Record<string, {id: bigint}>
    }){
        /* if businessDbInfo empty get data from db */
        if(!businessDbInfo || JSON.stringify(businessDbInfo) === '{}'){
            const {allDbBizObject} = await this.getFbBusinessData(tx, user, [], false);
            businessDbInfo = {...allDbBizObject}
        }
        /* get all without wa_business_accounts */
        const allDbWhatsApp = await tx.waBusinessAccount.findMany({
            where: { userId: user.id },
            select: {
                id: true,
                name: true,
                status: true,
                wabaId: true
            }
        })
        const allDbWhatsAppObject = {};
        const deleteArray = [];
        const allDbWhatsAppIds = allDbWhatsApp.map(b => {
            allDbWhatsAppObject[`whatsapp_${b.wabaId}`] = {...b};
            if(!whatsapp_business_management.includes(b.wabaId) || b.status === 'INACTIVE'){
                deleteArray.push(b.id);
            }
            return b.wabaId;
        });
        for(const each in whatsAppData){
            if(!allDbWhatsAppIds.includes(whatsAppData[each].id)){
                /* for create */
                const createRes = await tx.waBusinessAccount.create({
                    data: {
                        userId: user.id,
                        agencyId: user.agencyId,
                        wabaId: whatsAppData[each].id,
                        name: whatsAppData[each].name,
                        status: 'ACTIVE',
                        fbBusinessId: businessDbInfo[`business_${whatsAppData[each].owner_business_info.id}`].id
                    }
                })
                if(createRes){
                    allDbWhatsAppObject[`whatsapp_${createRes.wabaId}`] = {...createRes}
                }
            } else{
                /* update */
                await tx.waBusinessAccount.update({
                    where: {
                        id: allDbWhatsAppObject[`whatsapp_${whatsAppData[each].id}`].id
                    },
                    data: {
                        name: whatsAppData[each].name,
                        status: 'ACTIVE'
                    }
                })
            }
            if(whatsAppData[each].phones.length > 0){
                await this.waBusinessNumberManage({
                    tx,
                    user,
                    wabaId: whatsAppData[each].id,
                    numbers: whatsAppData[each].phones,
                    wabaDbId: allDbWhatsAppObject[`whatsapp_${whatsAppData[each].id}`].id
                })
            }
            /* work for phone number */
        }
        /* for delete or update status */
        /* TODO: update this code based on project business logic */
        if(deleteArray.length > 0){
            await tx.waBusinessAccount.updateMany({
                where: {
                    id: { in: deleteArray }
                },
                data: {
                    status: 'INACTIVE'
                }
            })  
            /* TODO: update it based on business logic */
            await tx.waBusinessNumber.deleteMany({
                where: {
                    waBusinessAccountId: { in: deleteArray },
                    userId: user.id
                },
            })
        }
    }
    private async waBusinessNumberManage({
        tx,
        // wabaId,
        user,
        numbers,
        wabaDbId
    }: {
        tx: Prisma.TransactionClient;
        user: LoginUser;
        wabaId: string;
        numbers: IWabaPhones;
        wabaDbId: bigint;
    }){
        /* get all number by waba id */
        const allDbPhones = await tx.waBusinessNumber.findMany({
            where: {
                userId: user.id
            },
            select: {
                id: true,
                phoneNumberId: true,
            }
        })
        const allDbPhonesObject = {};
        const allDbPhonesIds = allDbPhones.map(b => {
            allDbPhonesObject[`phone_${b.phoneNumberId}`] = {...b};
            return b.phoneNumberId;
        });
        let deleteArray = [...allDbPhonesIds];
        for(const each in numbers){
            const {id, display_phone_number, verified_name} = numbers[each]
            /* create */
            if(!allDbPhonesIds.includes(id)){
                await tx.waBusinessNumber.create({
                    data: {
                        phoneNumberId: id,
                        agencyId: user.agencyId,
                        displayPhoneNumber: verified_name,
                        number: display_phone_number,
                        verifiedName: verified_name,
                        userId: user.id,
                        waBusinessAccountId: wabaDbId
                    }
                })
                deleteArray = deleteArray.filter(item => item !== id);
                continue;
            }
            await tx.waBusinessNumber.update({
                where: {
                    id: allDbPhonesObject[`phone_${id}`].id
                },
                data: {
                    displayPhoneNumber: verified_name,
                    number: display_phone_number,
                    verifiedName: verified_name,
                }
            })
            deleteArray = deleteArray.filter(item => item !== id);
        }
        /* delete */
        /* TODO: update it based on business logic */
        // deleteArray.map(async (id: string) => {
        //     console.log('allDbPhonesObject[`phone_${id}`].id}', allDbPhonesObject[`phone_${id}`].id)
        //     await tx.waBusinessNumber.delete({
        //         where: {id: allDbPhonesObject[`phone_${id}`].id}
        //     })
        // })
    }
    private async getFbBusinessData(
        tx: Prisma.TransactionClient, 
        user: LoginUser, 
        business_management: IPersistMetaData['selectedIds']['business_management'] = [],
        needDelete: boolean = true
    ){
        /* get all without business_management */
        const allDbBiz = await tx.fbBusinessAccount.findMany({
            where: { userId: user.id },
            select: {
                id: true,
                name: true,
                status: true,
                businessId: true
            }
        })
        const allDbBizObject = {};
        const deleteArray = [];
        const allDbBizIds = allDbBiz.map(b => {
            allDbBizObject[`business_${b.businessId}`] = {...b};
            if(needDelete){
                if(!business_management.includes(b.businessId) || b.status === 'INACTIVE'){
                    deleteArray.push(b.id);
                }
            }
            return b.businessId;
        });
        return {
            allDbBizIds,
            allDbBizObject,
            deleteArray
        }
    }
}