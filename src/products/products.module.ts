import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductEntity } from './entities/product.entity';
import { BadgeEntity } from './entities/badge.entity';
import { ProductsService } from './services/products.service';
import { BadgesService } from './services/badges.service';
import { ProductsController } from './controller/products.controller';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { BadgesController } from './controller/badges.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductEntity, BadgeEntity]),
    // UserEntity belongs to UsersModule — don't register foreign entities here.
    // Importing UsersModule gives access to UserService and the JwtModule exports.
    forwardRef(() => CategoriesModule), // circular: Categories ↔ Products
    forwardRef(() => UsersModule),
    // MulterModule removed — multerConfig is passed per-interceptor in the controller,
    // which is safer (different routes can have different limits)
  ],
  controllers: [ProductsController, BadgesController],
  providers: [ProductsService, BadgesService],
  exports: [ProductsService, BadgesService],
})
export class ProductsModule {}
