import { NestFactory } from '@nestjs/core'; 
import { ValidationPipe, Logger } from '@nestjs/common'; 
import { AppModule } from './app.module'; 
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; 
import helmet from 'helmet'; 
 
async function bootstrap() { 
  const logger = new Logger('Bootstrap'); 
  const app = await NestFactory.create(AppModule); 
  const port = 3000; 
  const apiPrefix = 'api'; 
  const swaggerPath = 'docs'; 
  const frontendUrl = 'http://localhost:3001'; 
  app.use(helmet()); 
  app.enableCors({ origin: [frontendUrl], credentials: true }); 
  app.setGlobalPrefix(apiPrefix); 
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })); 
  const config = new DocumentBuilder().setTitle('DG STOK V5.0 API').setDescription('DG STOK API').setVersion('5.0.0').addBearerAuth().build(); 
  const document = SwaggerModule.createDocument(app, config); 
  SwaggerModule.setup(swaggerPath, app, document); 
  await app.listen(port); 
  logger.log('Calisiyor: http://localhost:' + port + '/' + apiPrefix); 
  logger.log('Swagger: http://localhost:' + port + '/' + swaggerPath); 
} 
bootstrap(); 
