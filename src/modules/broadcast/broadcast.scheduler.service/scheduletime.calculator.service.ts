import { Injectable } from "@nestjs/common";
import { BroadcastSettingDTO } from "../dto/broadcast.setting.dto";
import { Broadcast, BroadcastSetting, BroadcastType } from "@prisma/client";
import { DateTime, Duration } from "luxon";
import { from } from "form-data";
import { BroadcastProcessRequest } from "../broadcast.requset";
import { PinoLogger } from "nestjs-pino";

/**
 * @author @Milton
 */
@Injectable()
export class ScheduleTimeCalculationService {

    constructor(
        private readonly logger: PinoLogger,
    ){
        this.logger.setContext(ScheduleTimeCalculationService.name);
    }

    /**
     * @Method to calculate scheduleDate for immediate & schdule setting
     * @param broadcastProcessRequest 
     * @param scheduleDate 
     * @returns 
     */
    async calculateScheduleDateForSchduleSetting(broadcastProcessRequest: BroadcastProcessRequest, scheduleDate:DateTime): Promise<DateTime>{
        
        const broadcastType = broadcastProcessRequest.broadcastSettingDTO.broadcastType;
        console.log("broadcastType: ", broadcastType);
        switch(broadcastType){
            case BroadcastType.IMMEDIATE:
                const schduleDate: DateTime = await this.getScheduleDate(scheduleDate, broadcastProcessRequest);
                return schduleDate;
            case BroadcastType.SCHEDULE:
                return await this.calculateScheduleSettingScheduleDate(broadcastProcessRequest, scheduleDate);
            default:
                return null;
        }
    }

    /**
     * @Method to schedule data for scheduleSetting
     * @param broadcastProcessRequest
     * @param scheduleDate 
     * @returns 
     */
    private async calculateScheduleSettingScheduleDate(broadcastProcessRequest: BroadcastProcessRequest, scheduleDate: DateTime){
        const day = broadcastProcessRequest.broadcastSettingDTO.day;
        const timeString: String = broadcastProcessRequest.broadcastSettingDTO.time;
        const [hours, minutes, seconds] = timeString.split(":").map(Number);

        /**
         * not schdule same day
         */
        if(day > 0){
            const newDate = scheduleDate.plus({ days: day});
            const finalDateTime = newDate.plus({ hour: hours, minute: minutes, second: seconds});
            return await this.getScheduleDate(finalDateTime, broadcastProcessRequest);
        }
        
        /**
         * schedule for the same day
         */
        const finalDateTime = scheduleDate.plus({hours, minutes, seconds});
        console.log("finalDateTime: ", finalDateTime);
        return await this.getScheduleDate(finalDateTime, broadcastProcessRequest);
    }


    /**
     * @Method to calculate schedule time for recurring setting
     * @param broadcastSetting 
     * @param entryDate 
     */
    async calculateRecurringScheduleTime(broadcastProcessRequest: BroadcastProcessRequest, scheduleDate: DateTime){
        const [hours, minutes, seconds] = broadcastProcessRequest.broadcastSettingDTO.time.split(":").map(Number);
        const todayScheduleTime = DateTime.fromJSDate(new Date()).set({
            hour: hours,
            minute: minutes,
            second: seconds
        });
        console.log("todayScheduleTime:recurring: ", todayScheduleTime);
        if(todayScheduleTime > scheduleDate){
            scheduleDate = todayScheduleTime;
        }else{
            scheduleDate = scheduleDate.set({
                hour: hours,
                minute: minutes,
                second: seconds
            })
        }
        console.log("scheduleDate:recurring: ", scheduleDate);

        // let newScheduleDate = scheduleDate.plus({ days: broadcastProcessRequest.broadcastSettingDTO.day });
        // newScheduleDate = newScheduleDate.set({
        //     hour: hours,
        //     minute: minutes,
        //     second: seconds});
        // console.info("newRecurringScheduleDate: ", newScheduleDate);
        
        const recurringScheduleDate = await this.getScheduleDate(scheduleDate, broadcastProcessRequest);
        console.log("recurringScheduleDate: ", recurringScheduleDate);
        return recurringScheduleDate;    
    }

    /**
     * @method to calculate scheduleTime for broacast
     * @param scheduleDate 
     * @param broadcastProcessRequest 
     * @return
     */
    async getScheduleDate(scheduleDate: DateTime, broadcastProcessRequest: BroadcastProcessRequest) {
        const isValidateScheduleDate = await this.isValidateScheduleDate(scheduleDate, broadcastProcessRequest.broadcast);
        console.log("isValidateScheduleDate: ", isValidateScheduleDate);
        if(!isValidateScheduleDate){
            broadcastProcessRequest.success = false;
            broadcastProcessRequest.errorMessage = 'Schedule time not within global schedule date range';
            return null;
        }

        const isNowBroadcastRunningTime = await this.isNowBroadcastRunningTime(broadcastProcessRequest.broadcast, scheduleDate);
        this.logger.info("isNowBroadcastRunningTime: {}", isNowBroadcastRunningTime);
        console.log("isNowBroadcastRunningTime: {}", isNowBroadcastRunningTime);
        if(!isNowBroadcastRunningTime){
            return await this.adjustDateBasedOnRunningStatus(broadcastProcessRequest, scheduleDate);
        }
        return scheduleDate;
    }


    async adjustDateBasedOnRunningStatus(broadcastProcessRequest: BroadcastProcessRequest, addedDate: DateTime): Promise<DateTime> {
        const isRunningDate = await this.isNowBroadcastRunningTime(broadcastProcessRequest.broadcast, addedDate);
        console.log("isRunningDate:", isRunningDate);

        if (isRunningDate) {
            return addedDate;
        } else {
            return this.rescheduleDateForNotRunningDate(addedDate, broadcastProcessRequest);
        }
    }

    async rescheduleDateForNotRunningDate(rescheduleDate: DateTime, broadcastProcessRequest: BroadcastProcessRequest): Promise<DateTime> {
        console.log("rescheduleDateForNotRunningDate .....");
        let isNowBroadcastRunningTime = false;
        
        while (!isNowBroadcastRunningTime) {
            const tempScheduleDate = rescheduleDate;
            rescheduleDate = await this.checkSameDay(rescheduleDate, broadcastProcessRequest.broadcast);
            isNowBroadcastRunningTime = await this.isNowBroadcastRunningTime(broadcastProcessRequest.broadcast, rescheduleDate);
            if (isNowBroadcastRunningTime) {
                break;
            }
            
            rescheduleDate = tempScheduleDate;
            
            /*
            * check setting is recurring or not
            */
            if (broadcastProcessRequest.broadcastSettingDTO.broadcastType == BroadcastType.RECURRING) {
                rescheduleDate = rescheduleDate.plus({ days: broadcastProcessRequest.broadcastSettingDTO.day });
                // const isRunningTime = await this.isNowBroadcastRunningTime(broadcastProcessRequest.broadcast, rescheduleDate);
                // if (!isRunningTime) {
                //     const startTime = DateTime.fromJSDate(broadcastProcessRequest.broadcast.startTime).set({ year: rescheduleDate.year, month: rescheduleDate.month, day: rescheduleDate.day });
                //     rescheduleDate = rescheduleDate.set({ hour: startTime.hour, minute: startTime.minute });
                // }
            } else {
                const startTime = DateTime.fromJSDate(broadcastProcessRequest.broadcast.startTime).set({ year: rescheduleDate.year, month: rescheduleDate.month, day: rescheduleDate.day });
                rescheduleDate = rescheduleDate.plus({ days: 1 }).set({ hour: startTime.hour, minute: startTime.minute });
            }
            
            // Global schedule check
            if (!await this.isValidateScheduleDate(rescheduleDate, broadcastProcessRequest.broadcast)) {
                return null;
            }
        }
        console.log("rescheduleDateForNotRunningDate:", rescheduleDate);
        return rescheduleDate;
    }


    /**
     * @Check if a broadcast is currently allowed to run
     * @based on @global schedule, @selected days, and @timerange
     */
    async isNowBroadcastRunningTime(broadcast: Broadcast, scheduleDate: DateTime): Promise<boolean> {
     
      /** 
       * 1.@Check broadcast global schedule running duration
       */
      const isDateBetweenGlobalSchedule = await this.isValidateScheduleDate(scheduleDate, broadcast);
      if (!isDateBetweenGlobalSchedule) {
        console.error('Current time not within global schedule range')
        return false
      }

      /** 
       * 2. @Check broadcast schedule running day
      */
      const isScheduleDayMatched = await this.isScheduleDayMatched(broadcast, scheduleDate)
      if (!isScheduleDayMatched) {
        console.error('Current day not in selectedDays')
        return false
      }

      /** 
       * 3. @Check broadcast schedule running time 
      */
      const isNowRunningTime = await this.isTimeWithinRange(broadcast, scheduleDate);
      console.log('isNowRunningTime: ', isNowRunningTime)
      if (!isNowRunningTime) {
        this.logger.info('Current time not within start/end time range')
        return false
      }

      return true
    }
    
    /**
     * @check schedule day is in broadcast running selected days
     * @param broadcast 
     * @param scheduleDate 
     * @returns 
     */
    private async isScheduleDayMatched(broadcast: Broadcast, scheduleDate: DateTime):Promise<boolean>{
        const timeZone = broadcast.timeZone;
        const zonedScheduleDate = scheduleDate.setZone(timeZone);
        
        let runningDays: string[] = [];
        if(Array.isArray(broadcast.selectedDays)){
            runningDays = broadcast.selectedDays as string[];
        }
        console.log("runningDays", runningDays);
        console.log("today:", zonedScheduleDate.weekdayLong);
        
        const runningDaysLower = runningDays.map(d => d.toLowerCase());
        const nowDay = zonedScheduleDate.weekdayLong.toLowerCase(); // e.g. "monday"

        if (runningDaysLower.length > 0 && !runningDaysLower.includes(nowDay)) {
            return false;
        }
        return true;
    }

    /**
     * @check global schedule day configuration
     * @param scheduleDate 
     * @param broadcast 
     * @returns 
     */
    async isValidateScheduleDate(scheduleDate: DateTime, broadcast: Broadcast): Promise<boolean> {
        if(broadcast.fromDate == null && broadcast.toDate == null){
            return true;
        }
        const fromDate = broadcast.fromDate ? DateTime.fromJSDate(broadcast.fromDate) : null;
        const toDate = broadcast.toDate ? DateTime.fromJSDate(broadcast.toDate) : null;
        if (!(scheduleDate >= fromDate && scheduleDate <= toDate)) {
            return false;
        }
        return true;
    }


    /**
     * Checks if a target time is within the given start and end times.
     * Handles wrap-around (e.g., start 22:00, end 06:00).
     */
    async isTimeWithinRange(broadcast: Broadcast, scheduleDate: DateTime): Promise<boolean> {
        console.log("isTimeWithinRange: ........", scheduleDate);
        const startTime = DateTime.fromJSDate(broadcast.startTime).set({
            year: scheduleDate.year,
            month: scheduleDate.month,
            day: scheduleDate.day
        })

        const endTime = DateTime.fromJSDate(broadcast.endTime).set({
            year: scheduleDate.year,
            month: scheduleDate.month,
            day: scheduleDate.day
        })

        const nowTime = scheduleDate;

        this.logger.info('startTime: ', startTime)
        this.logger.info('endTime: ', endTime)
        this.logger.info('nowTime: ', nowTime)

        console.log('startTime: ', startTime)
        console.log('endTime: ', endTime)
        console.log('nowTime: ', nowTime)
        // Exact match with start or end
        if (nowTime.equals(startTime) || nowTime.equals(endTime)) {
            return true;
        }

        // Case 1: Wrap-around (end before start, e.g., 22:00 → 06:00)
        if (endTime < startTime) {
            return nowTime > startTime || nowTime < endTime;
        }

        // Case 2: within broadcast schedule time range
        return nowTime > startTime && nowTime < endTime;
    }

    async checkSameDay(rescheduleDate: DateTime, broadcast: Broadcast): Promise<DateTime> {
        const givenTime = rescheduleDate;

        const startTime = DateTime.fromJSDate(broadcast.startTime).set({
            year: rescheduleDate.year,
            month: rescheduleDate.month,
            day: rescheduleDate.day
        })

        const endTime = DateTime.fromJSDate(broadcast.endTime).set({
            year: rescheduleDate.year,
            month: rescheduleDate.month,
            day: rescheduleDate.day
        })

        console.log("startTime: ", startTime);
        console.log("endTime: ", endTime);
        console.log("givenTime: ", givenTime);

        if(givenTime < startTime){
            return rescheduleDate.set({hour: startTime.hour, minute: startTime.minute, second: 0, millisecond: 0});
        }else if(givenTime > endTime){
            return rescheduleDate.plus({ days: 1 }).set({hour: startTime.hour, minute: startTime.minute, second: 0, millisecond: 0});
        }
        return rescheduleDate;
    }


    /**
     * @Calculate schedule date for forward setting
     * @param broadcastProcessRequest  
     * @param completeBroadcastSetting 
     * @param scheduleDate 
     * @returns 
     */
    async calculateForwardSettingScheduleDate(broadcastProcessRequest: BroadcastProcessRequest, completeBroadcastSetting: BroadcastSetting, scheduleDate: DateTime): Promise<DateTime>{
        console.log("calculateForwardSettingScheduleDate: scheduleDate: ", scheduleDate);
        const completeSettingDay = completeBroadcastSetting.day ?? 0;
        const forwardSettingDay = broadcastProcessRequest.broadcastSettingDTO.day ?? 0;
        let dayDifference = 0;
        if(forwardSettingDay > completeSettingDay){
            dayDifference = forwardSettingDay - completeSettingDay;
        }
        if(dayDifference > 0){
            scheduleDate = scheduleDate.plus({ days: dayDifference });
        }
        const timeString: String = broadcastProcessRequest.broadcastSettingDTO.time ?? "00:00:00";
        const [hours, minutes, seconds] = timeString.split(":").map(Number);

        if(forwardSettingDay === 0){
            const finalDateTime = scheduleDate.plus({ hour: hours, minute: minutes, second: seconds});
            return await this.getScheduleDate(finalDateTime, broadcastProcessRequest);
        }else if(forwardSettingDay > 0){
            const finalDateTime = scheduleDate.set({
            hour: hours,
            minute: minutes,
            second: seconds});
            return await this.getScheduleDate(finalDateTime, broadcastProcessRequest);
        }
        
    }
}


