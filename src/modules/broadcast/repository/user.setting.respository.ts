import { Injectable } from "@nestjs/common";
import { UserSetting } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { User } from "src/modules/permission/dto/User";

@Injectable()
export class UserSettingRepository{

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger
    ){
        this.logger.setContext(UserSettingRepository.name);
    }

    /**
     * @Milton463
     * @param userId 
     * @param keys 
     * @returns 
     */
    async findUsertSettingByKeys(userId: bigint, keys:string[]): Promise<UserSetting[]>{
        if (userId == null || keys == null || keys.length === 0) {
            return [];
        }
        try{
           const userSettings = await this.prisma.userSetting.findMany({
                where:{
                    userId: userId,
                    settingKey:{
                        in: keys
                    }
                }
            })
            return (!userSettings || userSettings.length === 0) ? [] : userSettings;
        }catch(error){
            this.logger.error(error);
        }
        return [];
    }

}