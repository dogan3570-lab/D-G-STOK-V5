import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Modules
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CategoriesModule } from './modules/categories/categories/categories.module';
import { FinanceModule } from './modules/finance/finance.module';
import { InventoryModule } from './modules/inventory/inventory/inventory.module';
import { MarketplacesModule } from './modules/marketplaces/marketplaces/marketplaces.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NotificationsModule } from './modules/notifications/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { SuppliersModule } from './modules/suppliers/suppliers/suppliers.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { VariantsModule } from './modules/variants/variants.module';
import { AutomationModule } from './modules/automation/automation.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { HealthModule } from './modules/health/health.module';
import { ImportModule } from './modules/import/import.module';
import { SelfHealingModule } from './modules/self-healing/self-healing/self-healing.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres' as const,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'dg_store',
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV === 'development' ? true : false,
        logging: process.env.NODE_ENV === 'development',
        poolSize: parseInt(process.env.DB_POOL_SIZE || '20'),
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    // Core Business Modules
    ProductsModule,
    OrdersModule,
    AuthModule,
    UsersModule,
    BrandsModule,
    CategoriesModule,
    FinanceModule,
    InventoryModule,
    MarketplacesModule,
    MessagesModule,
    NotificationsModule,
    ReportsModule,
    ShipmentsModule,
    SuppliersModule,
    TemplatesModule,
    VariantsModule,
    AutomationModule,
    DiscountsModule,
    // Infrastructure Modules
    HealthModule,
    ImportModule,
    SelfHealingModule,
    AuditLogsModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
