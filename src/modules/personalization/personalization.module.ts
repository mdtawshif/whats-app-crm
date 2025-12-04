import { Module } from '@nestjs/common';
import { PersonalizationService } from './personalization.service';
import { PersonalizationController } from './personalization.controller';

@Module({
  controllers: [PersonalizationController],
  providers: [PersonalizationService],
})
export class PersonalizationModule {}
