import { BullBoardModule } from "@bull-board/nestjs";
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";

import { QUEUE_NAMES } from "@/common/constants/queues.constants";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "./bull-board-fastify.adapter";
import { authMiddleware } from "./bull-board.auth.middleware";

@Module({
  imports: [
    BullBoardModule.forFeature({
      name: QUEUE_NAMES.AUTO_RECHARGE,
      adapter: BullMQAdapter
    }, {
      name: QUEUE_NAMES.SYNC_META_DATA,
      adapter: BullMQAdapter
    }, {
      name: QUEUE_NAMES.CANCEL_SUBSCRIPTION,
      adapter: BullMQAdapter
    }, {
      name: QUEUE_NAMES.UPDATE_USER_PACKAGE,
      adapter: BullMQAdapter
    }, {
      name: QUEUE_NAMES.IMPORT_GOOGLE_CONTACTS,
      adapter: BullMQAdapter
    }, {
      name: QUEUE_NAMES.WEBHOOK_DATA_SYNC,
      adapter: BullMQAdapter
    }
    ),
    BullBoardModule.forRoot({
      route: "/queues",
      adapter: FastifyAdapter
    })
  ]
})
export class BullBoardAuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        authMiddleware(
          process.env.BULL_BOARD_USERNAME,
          process.env.BULL_BOARD_PASSWORD
        )
      )
      .forRoutes("/queues");
  }
}
