import { registerAs, type ConfigType } from '@nestjs/config';
import { APP_CONFIG_KEY } from './constant';

export const appConfig = registerAs(APP_CONFIG_KEY, () => ({
  databaseUrl: process.env.DATABASE_URL,

  // AWS Credentials
  awsAccessKey: process.env.AWS_ACCESS_KEY_ID_CONTENT,
  awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY_CONTENT,
  awsRegion: process.env.AWS_REGION_CONTENT,
  s3Bucket: process.env.S3_BUCKET_CONTENT,
  s3Endpoint: process.env.S3_ENDPOINT_CONTENT,
  awsS3ForcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE || false,

  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT,
  redisPassword: process.env.REDIS_PASSWORD,
  useRedisPassword: process.env.REDIS_USE_PASSWORD === 'yes',


  // Firebase Credentials
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebasePrivateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebaseClientId: process.env.FIREBASE_CLIENT_ID,
  firebaseClientX509CertUrl: process.env.FIREBASE_CLIENT_X509_CERT_URL,


  //google credentials
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,

  googleServiceClientEmail: process.env.GOOGLE_SERVICE_CLIENT_EMAIL,
  googleServicePrivateKey: process.env.GOOGLE_SERVICE_PRIVATE_KEY,

  accountServerApiBaseUrl: process.env.ACCOUNT_SERVER_API_BASE_URL,
  bullPruneAgeSeconds:
    parseInt(process.env.BULL_PRUNE_AGE_SECONDS, 10) || 24 * 60 * 60, // keep up to 24 hours
  bullPruneFailedAgeSeconds:
    parseInt(process.env.BULL_FAILED_PRUNE_AGE_SECONDS, 10) || 48 * 60 * 60, // keep up to 48 hours
  bullPruneKeepCount: parseInt(process.env.BULL_PRUNE_KEEP_COUNT, 10) || 500, // keep up to 500 jobs
  bullPruneFailedKeepCount:
    parseInt(process.env.BULL_PRUNE_FAILED_KEEP_COUNT, 10) || 1000, // keep up to 500 jobs
  jwtRefreshExpirationDays:
    parseInt(process.env.JWT_REFRESH_EXPIRATION_DAYS, 10) || 15,
  jwtAccessExpirationHours:
    parseInt(process.env.JWT_ACCESS_EXPIRATION_HOURS, 10) || 24,
  smtpUsername: process.env.SYSTEM_SMTP_USER_NAME,
  smtpPassword: process.env.SYSTEM_SMTP_PASSWORD,
  smtpPort: parseInt(process.env.SYSTEM_SMTP_PORT, 10) || 587,
  smtpHost: process.env.SYSTEM_SMTP_HOST,
  throttleTime: parseInt(process.env.THROTTLE_TTL, 10) || 60, // 1 minute (60 seconds)
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT, 10) || 300, // 300 requests per minute
  publicRequestApiKey: process.env.PUBLIC_REQUEST_API_KEY,
  takeTemporaryDataInDays:
    parseInt(process.env.TAKE_TEMPORARY_DATA_IN_DAYS, 10) || 5, // 5 day temporary data
  app_environment: process.env.APP_ENVIRONMENT,
}));


export type AppConfig = ConfigType<typeof appConfig>