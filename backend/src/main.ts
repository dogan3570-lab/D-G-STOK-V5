import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  const port = configService.get('PORT') || 3000;
  const apiPrefix = configService.get('API_PREFIX') || 'api';
  const swaggerPath = configService.get('SWAGGER_PATH') || 'docs';
  const frontendUrl = configService.get('FRONTEND_URL') || 'http://localhost:3001';
  
  app.use(helmet());
  app.enableCors({ 
    origin: [frontendUrl],
    credentials: true 
  });
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true, 
    transform: true 
  }));
  
  const config = new DocumentBuilder()
    .setTitle('DG STOK V5.0 API')
    .setDescription('DG STOK API - Pazaryeri Entegrasyonlu Stok Yönetim Sistemi')
    .setVersion('5.0.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('products', 'Product management')
    .addTag('orders', 'Order management')
    .addTag('marketplace', 'Marketplace integrations')
    .addTag('inventory', 'Inventory management')
    .addTag('categories', 'Category management')
    .addTag('suppliers', 'Supplier management')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(swaggerPath, app, document);
  
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger documentation: http://localhost:${port}/${swaggerPath}`);
  logger.log(`Environment: ${configService.get('NODE_ENV') || 'development'}`);
}
bootstrap(); 
