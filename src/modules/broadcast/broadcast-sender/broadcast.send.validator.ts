import { Injectable } from "@nestjs/common";
import { Broadcast, BroadcastContactStatus, BroadcastMessageQueue, BroadcastSettingStatus, BroadcastStatus, FbBusinessStatus, PauseResumeAction, User, UserStatus, WaBusinessStatus, WaNumberStatus } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { BroadcastSendRequest } from "./broadcast.send.request";
import { BroadcastSendHelperService } from "./broadcast.send.helperService";
import { BroadcastHelperService } from "../broadcast.helper.service";
import { ScheduleTimeCalculationService } from "../broadcast.scheduler.service/scheduletime.calculator.service";
import { DateTime } from "luxon";
import { WaBusinessAccountService } from "src/modules/whatsapp/service/wa.business.account.service";
import { P } from "pino";

/**
 * @Milton463
 */
@Injectable()
export class BroadcastSendValidator {

    constructor(
        private readonly logger: PinoLogger,
        private readonly broadcastSendHelperService: BroadcastSendHelperService,
        private readonly broadcastHelperService: BroadcastHelperService,
        private readonly scheduleTimeCalculationService: ScheduleTimeCalculationService
    ){
        this.logger.setContext(BroadcastSendValidator.name);
    }


    /**
     * check validation 
     * 1. user -> exists or active
     * 2. user package -> user has credit or inactive package
     * 3. user credit amount -> user has insufficient credit
     * 4. broadcast -> exists or running or current time is running time
     * 5. contact -> contact exists or active or not opt-out
     * 6. broadcast_contact -> contact exists in broadcast or is running
     * 7. broadcast-setting -> broadcast-setting exists or is active 
     * @param broadcastMessageQueue 
     * @param broadcastSendRequest 
     */
    async isValidRequest(broadcastMessageQueue: BroadcastMessageQueue, broadcastSendRequest: BroadcastSendRequest) {
        const isValidToSendBroadcast = false;
        if(!await this.validateUser(broadcastMessageQueue, broadcastSendRequest)){
            return isValidToSendBroadcast;
        }
        
        if(!await this.validateBroadcast(broadcastMessageQueue, broadcastSendRequest)){
            return isValidToSendBroadcast;
        }
        
        if(! await this.validateBusinessAccountAndBusinessNumber(broadcastSendRequest)){
            return isValidToSendBroadcast;
        }

        if(!await this.validatePackage(broadcastMessageQueue, broadcastSendRequest)){
            return isValidToSendBroadcast;
        }
        
        if(!await this.validateContact(broadcastMessageQueue, broadcastSendRequest)){
            return isValidToSendBroadcast;
        }

        if(!await this.validateBroadcastContact(broadcastMessageQueue, broadcastSendRequest)){
            return isValidToSendBroadcast;
        }

        if(!await this.validateBroadcastSetting(broadcastMessageQueue, broadcastSendRequest)){
            return isValidToSendBroadcast;
        }

        return true;
    }




    /**
     * @check if user is valid
     * @param broadcastMessageQueue 
     * @param broadcastSendRequest 
     * @returns 
     */
    private async validateUser(broadcastMessageQueue: BroadcastMessageQueue, broadcastSendRequest: BroadcastSendRequest): Promise<boolean>{
        const isValidUser = false;
        const user = await this.broadcastHelperService.findUserById(broadcastMessageQueue.userId);
        if (!user) {
          broadcastSendRequest.success = false
          broadcastSendRequest.errorMessage = 'User not found'
          return isValidUser;
        }
        if(user.status !== UserStatus.ACTIVE){
          broadcastSendRequest.success = false
          broadcastSendRequest.errorMessage = `Can't send broadcast! User Is inactive`;
          return isValidUser;
        }

        broadcastSendRequest.user = user;
        return true;
    }

    private async validateBusinessAccountAndBusinessNumber(broadcastSendRequest: BroadcastSendRequest){
        const isValidBusinessAccount = false;

        const waBusinessNumber = await this.broadcastSendHelperService.getWaBusinessNumberDataById(broadcastSendRequest.broadcastMessageQueue.waBusinessNumberId);
        if(!waBusinessNumber || waBusinessNumber.numberStatus!= WaNumberStatus.VERIFIED){
          broadcastSendRequest.success = false
          broadcastSendRequest.errorMessage = `Can't send broadcast! waBusinessNumber not found or is not verified`;
          return isValidBusinessAccount;
        }
        broadcastSendRequest.waBusinessNumber = waBusinessNumber;

        const waBusinessAccount = await this.broadcastSendHelperService.findWaBusinessAccount(waBusinessNumber.waBusinessAccountId);
        if(!waBusinessAccount || waBusinessAccount.status!= WaBusinessStatus.ACTIVE){
          broadcastSendRequest.success = false
          broadcastSendRequest.errorMessage = `Can't send broadcast! waBusinessAccouunt not found or is inactive`;
          return isValidBusinessAccount;
        }
        broadcastSendRequest.waBusinessAccount= waBusinessAccount;

        const fbBusinessAccount = await this.broadcastSendHelperService.findFBBusinessAccount(waBusinessAccount.fbBusinessId);
        if(!fbBusinessAccount || fbBusinessAccount.status!= FbBusinessStatus.ACTIVE){
          broadcastSendRequest.success = false
          broadcastSendRequest.errorMessage = `Can't send broadcast! FBBusinessAccouunt not found or is inactive`;
          return isValidBusinessAccount;
        }
        broadcastSendRequest.fbBusinessAccount = fbBusinessAccount;
        return true
    }

    /**
     * @Check user package
     * @param broadcastMessageQueue 
     * @param broadcastSendRequest 
     * @returns 
     */
    private async validatePackage(broadcastMessageQueue: BroadcastMessageQueue, broadcastSendRequest: BroadcastSendRequest): Promise<boolean>{
        const isValidPackage = false;
        let user = broadcastSendRequest.user;
        let userId = broadcastSendRequest.user.id;
        if(broadcastSendRequest.user.parentUserId){
            userId = broadcastSendRequest.user.parentUserId;
        }        

        const isParentuser = await this.isParentuser(user);
        if(!isParentuser){
            user = await this.broadcastHelperService.findUserById(userId);
        }
        
        if(!isParentuser && (!user || user.status!= UserStatus.ACTIVE)){
            broadcastSendRequest.success = false;
            broadcastSendRequest.errorMessage = 'User is not exists or inactive'
            return isValidPackage;
        }

        if (!user.currentCredit || user.currentCredit.lte(0)) {
          broadcastSendRequest.success = false,
          broadcastSendRequest.errorMessage = 'User has Insufficient credit';

          /**
           * pause the broadcast immedidate if user has no credit
           * 
           */
            await this.pauseBroadcastForInsufficientCredit(broadcastMessageQueue);

          return isValidPackage;
        }

        return true;
    }

    /**
     * @pause the broadcast if user has insufficient credit
     * @param broadcastMessageQueue 
     */
    private async pauseBroadcastForInsufficientCredit(broadcastMessageQueue: BroadcastMessageQueue){

        const pausedBroadcastData: any = {
            status: BroadcastStatus.PAUSED_FOR_CREDIT,
            pausedAt:new Date()
        }
        const pausedBroadcastDueCredit:boolean = await this.broadcastHelperService.changeBroadcastStatus(broadcastMessageQueue.broadcastId, pausedBroadcastData);
        console.log("pausedBroadcastDueCredit: ", pausedBroadcastDueCredit);

        const data: any = {
            status: BroadcastStatus.PAUSED_FOR_CREDIT
        }
       const pausedBroadcast = await this.broadcastHelperService.pauseBroadcastForInsufficientCredit(broadcastMessageQueue.broadcastId, data);
       this.logger.info("pausedBroadcastDueToInsufficientCredit: ", pausedBroadcast);
    }

    private async isParentuser(user: User):Promise<boolean>{
        return user != null && user.parentUserId === null
    }

    /**
     * @Check if broadcast is valid or is running
     * @param broadcastMessageQueue 
     * @param broadcastSendRequest 
     * @returns 
     */
    private async validateBroadcast(broadcastMessageQueue: BroadcastMessageQueue, broadcastSendRequest: BroadcastSendRequest): Promise<boolean>{
        const isValidBroadcast = false;
        const broadcast = await this.broadcastHelperService.findBroadcastById(broadcastMessageQueue.broadcastId);
        if (!broadcast) {
          broadcastSendRequest.success = false
          broadcastSendRequest.errorMessage = 'Broadcast not found'
          return isValidBroadcast;
        }

        if (broadcast.status !== BroadcastStatus.RUNNING) {
          broadcastSendRequest.success = false
          broadcastSendRequest.errorMessage = broadcast.status === BroadcastStatus.PAUSED_FOR_CREDIT ?  'Broadcast is paused due to insufficient credit: ' : 'Broadcast is not currently running'
          return isValidBroadcast;
        }
        broadcastSendRequest.broadcast = broadcast;

        const sentTime = DateTime.fromJSDate(broadcastMessageQueue.sentAt);
        const isNowBroadcastRunningTime = await this.scheduleTimeCalculationService.isNowBroadcastRunningTime(broadcast, sentTime);
        if(!isNowBroadcastRunningTime){
            broadcastSendRequest.success = false;
            broadcastSendRequest.errorMessage = 'The broadcast is not running at this time'
            return isValidBroadcast;
        }
        return true;
    }
    
    

    /**
     * @check Contact is valid
     * @param broadcastMessageQueue 
     * @param broadcastSendRequest 
     * @returns 
     */
    private async validateContact(broadcastMessageQueue: BroadcastMessageQueue, broadcastSendRequest: BroadcastSendRequest): Promise<boolean>{
        const isValidContact = false;
        const contact = await this.broadcastSendHelperService.findContactById(broadcastMessageQueue.contactId);
        if (!contact) {
          broadcastSendRequest.success = false
          broadcastSendRequest.errorMessage = 'Contact does not exist or is inactive';
          return isValidContact;
        }
        broadcastSendRequest.contact = contact;

        const isOptedOut = await this.broadcastSendHelperService.isContactOptedOut(broadcastMessageQueue.userId, broadcastMessageQueue.contactId);
        if(isOptedOut){
            broadcastSendRequest.success = false
            broadcastSendRequest.errorMessage = 'Contact has opted out of receiving messages';
            return isValidContact;
        }

        return true;
    }

    /**
     * @Check contact is running in broadcast
     * @param broadcastMessageQueue 
     * @param broadcastSendRequest 
     * @returns 
     */
    private async validateBroadcastContact(broadcastMessageQueue: BroadcastMessageQueue, broadcastSendRequest: BroadcastSendRequest): Promise<boolean>{
        const isValidBroadcastContact = false;
        const broadcastContact = await this.broadcastHelperService.findBroadcastContact(broadcastSendRequest.broadcast.id, broadcastSendRequest.contact.id);
        if(!broadcastContact){
            broadcastSendRequest.success = false;
            broadcastSendRequest.errorMessage = `Contact: ${broadcastSendRequest.contact.id} not exists in broadcast: ${broadcastSendRequest.broadcast.id}`;
            return isValidBroadcastContact;
        }
        if(broadcastContact.status !=BroadcastContactStatus.RUNNING){
            broadcastSendRequest.success = false;
            broadcastSendRequest.errorMessage = `Contact: ${broadcastSendRequest.contact.id} is not running in broadcast: ${broadcastSendRequest.broadcast.id}`;
            return isValidBroadcastContact;
        }
        return true;
    }

    /**
     * @Check broadcast setting is valid
     * @param broadcastMessageQueue 
     * @param broadcastSendRequest 
     * @returns 
     */
    private async validateBroadcastSetting(broadcastMessageQueue: BroadcastMessageQueue, broadcastSendRequest: BroadcastSendRequest): Promise<boolean>{
        const isValidBroadcastSetting = false;
        const broadcastSetting = await this.broadcastSendHelperService.findBroadcastSettingById(broadcastMessageQueue.broadcastSettingId);
        if (!broadcastSetting || broadcastSetting.status != BroadcastSettingStatus.ACTIVE) {
          broadcastSendRequest.success = false
          broadcastSendRequest.errorMessage = 'Broadcast setting not found'
          return isValidBroadcastSetting;
        }
        broadcastSendRequest.broadcastSetting = broadcastSetting;
        return true;
    }



}