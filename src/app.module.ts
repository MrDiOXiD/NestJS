import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
  RequestMethod,
  Logger,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';

import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { dataSourceOptions } from './db/data-source'; // 👈 Synchronized DB options
import { CurrentUserMiddleware } from './utils/middleware/currentUser.middleware';
import { CompressionMiddleware } from './utils/middleware/compression.middleware';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PaymentModule } from './payment/payment.module';
import { WishlistModule } from './whishlist/whishlist.module';
import { AddressesModule } from './addressess/addresses.module';
import { DeliveryModule } from './delivery/delivery.module';

@Module({
  imports: [
    // ConfigModule MUST come first
    ConfigModule.forRoot({ isGlobal: true }),

    // 👈 Uses the exact DB settings verified in data-source.ts
    TypeOrmModule.forRoot(dataSourceOptions),

    ThrottlerModule.forRoot([{ ttl: 60, limit: 10 }]),

    UsersModule,
    AuditModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    ReviewsModule,
    PaymentModule,
    WishlistModule,
    AddressesModule,
    DeliveryModule,
  ],
})
export class AppModule implements NestModule, OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const requiredArvanEnv = [
      'ARVAN_ENDPOINT',
      'ARVAN_ACCESS_KEY',
      'ARVAN_SECRET_KEY',
      'ARVAN_BUCKET_NAME',
      'ZIBAL_MERCHANT',
      'APP_URL',
      'FRONTEND_URL',
    ];

    for (const envVar of requiredArvanEnv) {
      if (!process.env[envVar]) {
        this.logger.warn(
          `⚠️ Environment variable ${envVar} is missing. Set it in Runflare Dashboard.`,
        );
      }
    }
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CompressionMiddleware, CurrentUserMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}