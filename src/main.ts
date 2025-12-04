import { fastifyMultipart } from '@fastify/multipart'; // Import Fastify multipart for file uploads
import { ValidationPipe, VersioningType } from '@nestjs/common'; // Import NestJS validation and versioning
import { ConfigService } from '@nestjs/config'; // Import ConfigService for configuration
import { NestFactory } from '@nestjs/core'; // Import NestJS core factory
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'; // Import Fastify adapter
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; // Import Swagger utilities
import type { IncomingMessage } from 'http'; // Import HTTP IncomingMessage type
import hyperid from 'hyperid'; // Import hyperid for unique request IDs
import { Logger } from 'nestjs-pino';

import '@/utils/bigint-patch'; // Import custom bigint patch utility
import { AppModule } from './app.module'; // Import root AppModule
import { getApiConfig } from './config/config.utils'; // Import API config utility
import { PermissionRegistry } from './utils/permission-registry';

function getFastifyAdapter() {
  const getUniqueId = hyperid({ urlSafe: true }); // Generate unique ID with URL-safe format

  return new FastifyAdapter({
    genReqId(req: IncomingMessage): string {
      return (req.headers['request-id'] as string) || getUniqueId(); // Generate request ID or use header
    },
  });
}

function setupSwagger(app: NestFastifyApplication) {
  const APP_MODE = process.env.NODE_ENV || process.env.APP_ENVIRONMENT || 'development'; // Determine app mode

  console.log(`App running on ==> ${APP_MODE}`); // Log current environment mode

  //if (APP_MODE !== 'prod') {
  const config = new DocumentBuilder()
    .setTitle('Whats APP CRM')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .setDescription(`Whats APP CRM ${APP_MODE} API Documentation`)
    .setVersion('0.0.1')
    .build();

  const document = SwaggerModule.createDocument(app, config); // Generate Swagger document
  SwaggerModule.setup('api/whats-app-crm/docs', app, document); // Set up Swagger endpoint
  //}
}

async function bootstrap() {

  // 1️⃣ Initialize permission registry first
  await PermissionRegistry.init();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    getFastifyAdapter(),
    { bufferLogs: true, rawBody: true, bodyParser: true }, // Enable logging buffering and body parsing
  );

  app.register(fastifyMultipart as any, {
    limits: { fileSize: 25 * 1024 * 1024 }, // Limit file size to 25MB
  });

  const logger = app.get(Logger); // Get Pino logger instance
  app.useLogger(logger); // Set logger for application
  app.flushLogs(); // Flush buffered logs

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason); // Log unhandled promise rejections
  });

  const configService = app.get<ConfigService>(ConfigService); // Get ConfigService instance
  const apiConfig = getApiConfig(configService)  // Retrieve API configuration

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true }, })); // Apply global validation
  app.setGlobalPrefix(apiConfig.apiPrefix); // Set global API prefix
  app.enableVersioning({
    defaultVersion: apiConfig.version, // Set default API version
    type: VersioningType.URI, // Use URI-based versioning
  });


  setupSwagger(app); // Initialize Swagger


  await app.listen(apiConfig.port, '0.0.0.0'); // Start app on configured port and host

  console.log(`🚀 App running on ==> http://localhost:${apiConfig.port}`); // Log app URL
  console.log(`📜 Swagger Docs ==> http://localhost:${apiConfig.port}/api/whats-app-crm/docs`); // Log Swagger URL


}

bootstrap(); // Start the application