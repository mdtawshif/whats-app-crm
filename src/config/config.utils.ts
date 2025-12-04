import { ConfigService } from '@nestjs/config';
import { type ApiConfig } from './api.config';
import { type AppConfig } from './app.config';
import { API_CONFIG_KEY, APP_CONFIG_KEY } from './constant';

/**
 * Get api config
 * @description singleton wrapper function
 * @param configService
 * @returns
 * */
export function getApiConfig(configService: ConfigService): ApiConfig {
    return configService.get<ApiConfig>(API_CONFIG_KEY);
}

/**
 *  Get app config
 * @description singleton wrapper function
 * @param configService 
 * @returns 
 */

export function getAppConfig(configService: ConfigService): AppConfig {
    return configService.get<AppConfig>(APP_CONFIG_KEY);
}