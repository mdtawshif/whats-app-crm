import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GA4Service {
  private readonly measurementId: string;
  private readonly apiSecret: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.measurementId = this.configService.get<string>('GA4_MEASUREMENT_ID');
    this.apiSecret = this.configService.get<string>('GA4_API_SECRET');
  }

  async sendEvent(payload: {
    client_id: string;
    events: {
      name: string;
      params: Record<string, any>;
    }[];
  }): Promise<any> {

    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;
    console.log('GA4Service url', url);
    console.log('payload : ', payload);
    try {
      const response = await firstValueFrom(this.httpService.post(url, payload));
      console.log('response : ', response);
      return response.data; //  this will show up in your console
    } catch (error) {
      console.error('Failed to send GA4 event:', error?.response?.data || error.message);
      throw error;
    }

  }
}
