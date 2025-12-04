import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'nestjs-prisma';
import { WaHelperService } from './wa-helper.service';
import { MetaOAuthTokenService } from './meta.oauth.token.service';
import { MetadataSyncJobStatus, MetadataSyncJobType, WaBusinessStatus } from '@prisma/client';
import { getBusinessProfileDataById, getWabaDataById, getWabaNumberById, registerPhoneNumber, setNewPinPhoneNumber, subscribeWabaApp } from '@/common/wa-helper/wa-helper';
import { WabaIntegrationService } from './waba.integration.service';

@Injectable()
export class MetaDataSyncJobService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(MetaDataSyncJobService.name)
    private readonly logger: PinoLogger,
    private readonly waHelperService: WaHelperService,
    private readonly metaOAuthTokenService: MetaOAuthTokenService,
    private readonly wabaIntegrationService: WabaIntegrationService,
  ) {}

  async createNewAction(userId: bigint, type: MetadataSyncJobType = "ACCOUNT", tokenId: bigint){
    return await this.prisma.metaDataSyncJob.create({
      data: {
        userId: userId,
        type: type,
        metaOauthTokenId: tokenId
      },
    });
  }

  /* cron job for syncing meta signup data */
  async syncWithMeta(){
    const data = await this.prisma.metaDataSyncJob.findMany({
      where: {
        status: MetadataSyncJobStatus.PENDING,
        type: MetadataSyncJobType.ACCOUNT
      },
      select: {
        id: true,
        userId: true,
        tryAttempt: true,
        metaOauthTokenId: true
      },
      skip: 0,
      take: 20
    })

    if(data.length > 0){
      for(const item of data){
        try{
          if(item.tryAttempt >= 4){
            /* revoked access token */
            this.metaOAuthTokenService.disconnectMeta(item.id);
            await this.prisma.metaDataSyncJob.update({
              where: {
                id: item.id
              },
              data: {
                status: MetadataSyncJobStatus.FAILED,
                failMessage: "Exceed attempts"
              }
            })
            continue;
          }

          /* get access token */
          const accessToken = await this.waHelperService.getWithRefreshTokenById(item.metaOauthTokenId);
          console.log("accessToken", accessToken)
          if(accessToken.token){
            /* update status to in progress */
            await this.prisma.metaDataSyncJob.update({
              where: {
                id: item.id
              },
              data: {
                status: MetadataSyncJobStatus.IN_PROGRESS
              }
            })
            console.log("----0-----")
            const businessPortfolio = await getBusinessProfileDataById(accessToken.profileData.business_id, accessToken.token);
            console.log("businessPortfolio", businessPortfolio)
            const businessDbId = await this.wabaIntegrationService.getOrStoreBusinessAccount(item.userId, {businessId: businessPortfolio.id, name: businessPortfolio.name, agencyId: accessToken.agencyId});
            if(!businessDbId){
              await this.prisma.metaDataSyncJob.update({
                where: {
                  id: item.id
                },
                data: {
                  status: MetadataSyncJobStatus.FAILED,
                  failMessage: "Can not store meta data. Business data missing",
                  tryAttempt: { increment: 1 }
                }
              });
              continue;
            }
            console.log("----1-----")

            const wabaAccount = await getWabaDataById(accessToken.profileData.waba_id, accessToken.token)
            const wabaAccountDbId = await this.wabaIntegrationService.getOrStoreWabaAccount(item.userId, {wabaId: wabaAccount.id, name: wabaAccount.name, agencyId: accessToken.agencyId, businessId: businessDbId});
            if(!wabaAccountDbId){
              await this.prisma.metaDataSyncJob.update({
                where: {
                  id: item.id 
                },
                data: {
                  status: MetadataSyncJobStatus.FAILED,
                  failMessage: "Can not store meta data. Waba data missing",
                  tryAttempt: { increment: 1 }
                }
              });
              continue;
            }

            console.log("----2-----")

            /* phone number */
            const wabaNumber = await getWabaNumberById(accessToken.profileData.phone_number_id, accessToken.token)
            const wabaNumberDbId = await this.wabaIntegrationService.getOrStoreWabaNumber(
              item.userId, 
              {
                verified_name: wabaNumber.verified_name,
                code_verification_status: wabaNumber.code_verification_status,
                display_phone_number: wabaNumber.display_phone_number,
                quality_rating: wabaNumber.quality_rating,
                number_id: wabaNumber.id,
                wabaId: wabaAccountDbId, 
                agencyId: accessToken.agencyId,
                tokenId: item.metaOauthTokenId
              }
            );
            if(!wabaNumberDbId){
              await this.prisma.metaDataSyncJob.update({
                where: {
                  id: item.id
                },
                data: {
                  status: MetadataSyncJobStatus.FAILED,
                  failMessage: "Can not store meta data. Waba data missing",
                  tryAttempt: { increment: 1 }
                }
              });
              continue;
            }

            console.log("----4-----")

            /* TODO: do it later */
            /* Action: get system user and add system user to waba */

            try{
              /* subscribed app */
              const makeSubscribed = await subscribeWabaApp(accessToken.profileData.waba_id, accessToken.token);
              await this.wabaIntegrationService.updateWabaForSubscription(
                wabaAccountDbId,
                makeSubscribed,
                makeSubscribed ? WaBusinessStatus.ACTIVE : WaBusinessStatus.INACTIVE
              )
            }
            catch(e){
              console.log("----------4---------", JSON.stringify(e))
              await this.wabaIntegrationService.updateWabaForSubscription(
                wabaAccountDbId,
                false,
                WaBusinessStatus.INACTIVE
              )
            }
            
            try{
              console.log("----5-----")
              const numberDetails = await this.wabaIntegrationService.getPhoneNumberDetails(wabaNumberDbId)
              const setPin = await setNewPinPhoneNumber(accessToken.profileData.phone_number_id, accessToken.token, numberDetails.pinCode);
              if(setPin){
                const registerNumber = await registerPhoneNumber(accessToken.profileData.phone_number_id, accessToken.token, numberDetails.pinCode);
                await this.wabaIntegrationService.updatePhoneNumberForRegister(
                  wabaNumberDbId,
                  registerNumber
                )
              }
            }
            catch(e){
              console.log("----5555-----", JSON.stringify(e));
              await this.wabaIntegrationService.updatePhoneNumberForRegister(
                wabaNumberDbId,
                false
              )
            }

            console.log("----6-----")

            await this.createNewAction(item.userId, MetadataSyncJobType.TEMPLATE, item.metaOauthTokenId)
            await this.prisma.metaDataSyncJob.update({
              where: {
                id: item.id
              },
              data: {
                status: MetadataSyncJobStatus.COMPLETED,
                failMessage: ""
              }
            })

            console.log("----7-----")

          } else{
            /* update status to failed */
            await this.prisma.metaDataSyncJob.update({
              where: {
                id: item.id
              },
              data: {
                status: MetadataSyncJobStatus.FAILED,
                failMessage: "No meta access token found !"
              }
            })
          }
        }
        catch(e){
          console.log("e", e)
          /* update status to failed */
          await this.prisma.metaDataSyncJob.update({
            where: {
              id: item.id
            },
            data: {
              status: MetadataSyncJobStatus.FAILED,
              failMessage: "No meta access token found !!!"
            }
          })
        }
      }
    }
  }

  private async syncMessageTemplate(){
    const data = await this.prisma.metaDataSyncJob.findMany({
      where: {
        status: MetadataSyncJobStatus.PENDING,
        type: MetadataSyncJobType.TEMPLATE
      },
      select: {
        id: true,
        userId: true,
        tryAttempt: true
      },
      skip: 0,
      take: 20
    })

    if(data.length > 0){
      for(const item of data){
        if(item.tryAttempt >= 4){
          /* revoked access token */
          this.metaOAuthTokenService.disconnectMeta(item.userId);
          await this.prisma.metaDataSyncJob.update({
            where: {
              id: item.id
            },
            data: {
              status: MetadataSyncJobStatus.FAILED,
              failMessage: "Exceed attempts"
            }
          })
          continue;
        }

        /* get access token */
        const accessToken = await this.waHelperService.getWithRefreshToken(item.userId);
        if(accessToken.token){
          /* update status to in progress */
          await this.prisma.metaDataSyncJob.update({
            where: {
              id: item.id
            },
            data: {
              status: MetadataSyncJobStatus.IN_PROGRESS
            }
          })

          /* get all waba account for user */

          // const templates = await getMessageTemplates()

          /* old */
          // const selectedIds = await getSelectedBusinessIds(accessToken.token);
          // const [businessData, whatsAppData] = await Promise.all([
          //   fetchBusinessesDataByIds(selectedIds.business_management, accessToken.token),
          //   fetchWhatsAppAccountDataByIds(selectedIds.whatsapp_business_management, accessToken.token, selectedIds.business_management),
          // ]);
          // const user = await this.prisma.user.findFirst({
          //   where: {id: item.userId},
          //   select: {
          //     agencyId: true,
          //     teamId: true,
          //     id: true,
          //   }
          // })
          // const res = await this.wabaIntegrationService.persistMetaData({
          //   user: user as LoginUser,
          //   selectedIds: selectedIds,
          //   businessData: businessData,
          //   whatsAppData: whatsAppData,
          // })
          // if(res.ok){
          //   await this.prisma.metaDataSyncJob.update({
          //     where: {
          //       id: item.id
          //     },
          //     data: {
          //       status: MetaDataSyncJobStatus.COMPLETED,
          //       failMessage: ""
          //     }
          //   })
          // }
          // else{
          //   await this.prisma.metaDataSyncJob.update({
          //     where: {
          //       id: item.id
          //     },
          //     data: {
          //       status: MetaDataSyncJobStatus.FAILED,
          //       failMessage: "Can not store meta data",
          //       tryAttempt: { increment: 1 }
          //     }
          //   })
          // }
          /* old */
        } else{
          /* update status to failed */
          await this.prisma.metaDataSyncJob.update({
            where: {
              id: item.id
            },
            data: {
              status: MetadataSyncJobStatus.FAILED,
              failMessage: "No meta access token found !"
            }
          })
        }
      }
    }
  }
}