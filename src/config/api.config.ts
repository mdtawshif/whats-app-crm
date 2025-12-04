import { registerAs, type ConfigType } from '@nestjs/config';
import { API_CONFIG_KEY } from './constant';

export const apiConfig = registerAs(API_CONFIG_KEY, () => ({
  port: parseInt(process.env.API_PORT, 10) || 4000,
  version: process.env.API_VERSION,
  apiPrefix: process.env.API_PREFIX || 'api',
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  clientBaseUrl: process.env.CLIENT_BASE_URL || 'http://localhost:5173',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:6969/api/whats-app-crm/v1',
}));

export type ApiConfig = ConfigType<typeof apiConfig>;
