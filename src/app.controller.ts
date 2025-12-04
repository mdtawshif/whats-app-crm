import {
  Controller,
  Get,
  UseGuards,
  VERSION_NEUTRAL,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { AppService } from './app.service';
import { ApiKeyGuard } from './common/guard/api-key.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/health')
  @Version(VERSION_NEUTRAL)
  getHealth(): { message: string } {
    return this.appService.getHealth();
  }

  @Get('/status/check/system')
  @Version(VERSION_NEUTRAL)
  @ApiExcludeEndpoint()
  checkSystemStatus(): { message: string } {
    return this.appService.checkSystemStatus();
  }

  @Get('/health-details')
  @ApiBearerAuth()
  @UseGuards(ApiKeyGuard)
  @Version(VERSION_NEUTRAL)
  getHealthDetails(): Promise<any> {
    console.log('getHealthDetails');
    return this.appService.getHealthDetails();
  }
}
