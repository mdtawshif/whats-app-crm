import { createActivity } from "@/common/helpers/activity-log.helper";
import { Inject, Injectable } from "@nestjs/common";
import { ActivityAction, ActivityCategory } from "@prisma/client";
import { BasicUser } from "src/modules/user/dto/user.dto";


@Injectable()
export class TriggerActivityLogService {

constructor(){

}

async buildAndCreateActivityLog(user: BasicUser, activityAction: ActivityAction, activityCategory: ActivityCategory, description: string, triggerId:bigint ) {  
        await createActivity({
            userId: user.parentUserId ?? user.id,
            agencyId: user.agencyId,
            createdBy: user.id,
            action: activityAction,
            category: activityCategory,
            description: description,
            triggerId: triggerId
        })
    }
}