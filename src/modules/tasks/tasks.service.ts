import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WebhookStatus, TriggerAction } from '@prisma/client';
import { Queue } from "bullmq";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { JOB_IDS, TRIGGER_ACTION_JOB } from '../../common/constants/queues.constants';

@Injectable()
export class TasksService {
  constructor(
    @InjectPinoLogger(TasksService.name)
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,

    @InjectQueue(QUEUE_NAMES.AUTO_RECHARGE)
    private readonly checkDailyAutoRecharge: Queue,

    @InjectQueue(QUEUE_NAMES.SYNC_META_DATA)
    private readonly checkSyncMetaData: Queue,

    @InjectQueue(QUEUE_NAMES.CANCEL_SUBSCRIPTION)
    private readonly checkCancelSubscription: Queue,

    @InjectQueue(QUEUE_NAMES.UPDATE_USER_PACKAGE)
    private readonly checkUpdateUserPackage: Queue,

    @InjectQueue(QUEUE_NAMES.IMPORT_GOOGLE_CONTACTS)
    private readonly checkImportGoogleContacts: Queue,

    @InjectQueue(QUEUE_NAMES.WEBHOOK_DATA_SYNC)
    private readonly checkWebhookDataSync: Queue,

    @InjectQueue(QUEUE_NAMES.TWILIO_WEBHOOK_DATA_SYNC)
    private readonly checkTwilioWebhookDataSync: Queue,

    @InjectQueue(QUEUE_NAMES.CRON_TRIGGER_JOB)
    private readonly cronTriggerJobQueue: Queue,

    @InjectQueue(QUEUE_NAMES.REALTIME_TRIGGER_JOB)
    private readonly realtimeTriggerJobQueue: Queue,

    @InjectQueue(QUEUE_NAMES.TRIGGER_ACTION_JOB)
    private readonly triggerActionJobQueue: Queue
  ) { }

  onModuleInit() {
    this.init()
  }
  async init() {
    const env = this.configService.get<string>("app.app_environment");
    console.log("ENV VALUE:", env);

    //if (env === "development") {
    // console.log("We are in development!");
    //} else {
    console.log("Not development, running cron setup");
    await this.removeAllRepeatableJobs();
    await this.cronSetupSync();
    //}
  }

  async cronSetupSync() {
    const time = new Date();
    console.log("======> Setting up repeatable job at", time);

    /* step 3 start */
    await this.autoRechargeCronJob();
    await this.syncMetaDataCronJob();
    await this.cancelSubscriptionCornJob();
    await this.updateUserPackageCronJob();
    await this.importGoogleContactsCronJob();
    await this.webhookDataSyncCronJob();
    await this.twilioWebhookDataSyncCronJob();
    await this.cronTriggerJobQueueCronJob();
    await this.realtimeTriggerJobQueueCronJob();
    await this.triggerActionJobQueueCronJob();

    /* step 3 end */

    // await this.sendReminderEmailCronJob();


    // await this.packageRenewCronJob();

    // await this.trialUserActivationProcessCronJob();

    // await this.deactivateUserProcessCronJob();

    // await this.removeInCompleteUserProcessCronJob();

    // await this.negativeUsersReminderProcessCronJob();

    // await this.negativeUsersListProcessCronJob();
  }



  /* step: 1 start */
  private async cancelSubscriptionCornJob() {
    await this.setupCronJob(
      this.checkCancelSubscription,
      QUEUE_NAMES.CANCEL_SUBSCRIPTION,
      CronExpression.EVERY_MINUTE,
      JOB_IDS.CANCEL_SUBSCRIPTION_JOB_ID
    );
  }

  private async autoRechargeCronJob() {
    await this.setupCronJob(
      this.checkDailyAutoRecharge,
      QUEUE_NAMES.AUTO_RECHARGE,
      CronExpression.EVERY_5_MINUTES,
      JOB_IDS.AUTO_RECHARGE_JOB_ID
    );
  }

  private async syncMetaDataCronJob() {
    await this.setupCronJob(
      this.checkSyncMetaData,
      QUEUE_NAMES.SYNC_META_DATA,
      CronExpression.EVERY_MINUTE,
      JOB_IDS.SYNC_META_DATA_JOB_ID
    );
  }

  private async updateUserPackageCronJob() {
    await this.setupCronJob(
      this.checkUpdateUserPackage,
      QUEUE_NAMES.UPDATE_USER_PACKAGE,
      CronExpression.EVERY_MINUTE,
      JOB_IDS.UPDATE_USER_PACKAGE_JOB_ID
    );
  }

  private async importGoogleContactsCronJob() {
    await this.setupCronJob(
      this.checkImportGoogleContacts,
      QUEUE_NAMES.IMPORT_GOOGLE_CONTACTS,
      CronExpression.EVERY_MINUTE,
      JOB_IDS.IMPORT_GOOGLE_CONTACTS_JOB_ID
    );
  }

  private async webhookDataSyncCronJob() {
    await this.setupCronJob(
      this.checkWebhookDataSync,
      QUEUE_NAMES.WEBHOOK_DATA_SYNC,
      CronExpression.EVERY_MINUTE,
      JOB_IDS.WEBHOOK_DATA_SYNC_ID
    );
  }

  private async twilioWebhookDataSyncCronJob() {
    await this.setupCronJob(
      this.checkTwilioWebhookDataSync,
      QUEUE_NAMES.TWILIO_WEBHOOK_DATA_SYNC,
      CronExpression.EVERY_30_SECONDS,
      JOB_IDS.TWILIO_WEBHOOK_DATA_SYNC_ID
    );
  }

  private async cronTriggerJobQueueCronJob() {
    await this.setupCronJob(
      this.cronTriggerJobQueue,
      QUEUE_NAMES.CRON_TRIGGER_JOB,
      CronExpression.EVERY_30_SECONDS,
      JOB_IDS.CRON_TRIGGER_JOB_ID
    );
  }

  private async realtimeTriggerJobQueueCronJob() {
    await this.setupCronJob(
      this.realtimeTriggerJobQueue,
      QUEUE_NAMES.REALTIME_TRIGGER_JOB,
      CronExpression.EVERY_30_SECONDS,
      JOB_IDS.REALTIME_TRIGGER_JOB_ID
    );
  }

  private async triggerActionJobQueueCronJob() {
    await this.setupCronJob(
      this.triggerActionJobQueue,
      QUEUE_NAMES.TRIGGER_ACTION_JOB,
      CronExpression.EVERY_30_SECONDS,
      JOB_IDS.TRIGGER_ACTION_JOB_ID
    );
  }
  /* step: 1 end */



  private async setupCronJob(queue: Queue, queueName: string, pattern: string, jobId: string) {
    this.logger.info(`======> Setting up job: ${queueName} <======`, new Date());

    await queue.add(
      queueName,
      {},
      {
        repeat: { pattern: pattern, jobId },
        removeOnComplete: true,
      }
    );

    const cronJobData = await this.prisma.cronJob.create({
      data: {
        name: queueName,
        jobId,
        status: WebhookStatus.QUEUE,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastProcessedAt: new Date(),
        nextProcessAt: new Date(),
        message: '',
        pattern: pattern
      }
    });

    console.log(`${queueName} cron job created`, cronJobData);
  }


  private async removeRepeatableJobsForQueue(queue: Queue, queueName: string) {
    console.log('-------remove existing cron job-----')
    const jobs = await queue.getRepeatableJobs();
    for (const job of jobs) {
      if (job.name === queueName) {
        await queue.removeRepeatable(
          job.name,
          {
            pattern: job.pattern,
            jobId: job.id
          }
        );
        this.logger.info(`Removed stale repeatable job ${queueName} with pattern ${job.pattern}`);
      }
    }
  }

  async removeAllRepeatableJobs() {
    console.log("removeAllRepeatableJobs");

    await this.prisma.cronJob.deleteMany(
      {
        where: {
          id: {
            gt: 0
          }
        }
      }
    );

    /* step 2 start */
    await this.removeRepeatableJobsForQueue(this.checkDailyAutoRecharge, QUEUE_NAMES.AUTO_RECHARGE);
    await this.removeRepeatableJobsForQueue(this.checkSyncMetaData, QUEUE_NAMES.SYNC_META_DATA);
    await this.removeRepeatableJobsForQueue(this.checkCancelSubscription, QUEUE_NAMES.CANCEL_SUBSCRIPTION);
    await this.removeRepeatableJobsForQueue(this.checkUpdateUserPackage, QUEUE_NAMES.UPDATE_USER_PACKAGE);
    await this.removeRepeatableJobsForQueue(this.checkImportGoogleContacts, QUEUE_NAMES.IMPORT_GOOGLE_CONTACTS);
    await this.removeRepeatableJobsForQueue(this.checkWebhookDataSync, QUEUE_NAMES.WEBHOOK_DATA_SYNC);
    await this.removeRepeatableJobsForQueue(this.checkTwilioWebhookDataSync, QUEUE_NAMES.TWILIO_WEBHOOK_DATA_SYNC);
    await this.removeRepeatableJobsForQueue(this.cronTriggerJobQueue, QUEUE_NAMES.CRON_TRIGGER_JOB);
    await this.removeRepeatableJobsForQueue(this.realtimeTriggerJobQueue, QUEUE_NAMES.REALTIME_TRIGGER_JOB);
    await this.removeRepeatableJobsForQueue(this.triggerActionJobQueue, QUEUE_NAMES.TRIGGER_ACTION_JOB); 
    /* step 2 end */

  }

}
