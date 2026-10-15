import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductEntity } from '../products/entities/product.entity';
import { BadgeEntity } from '../products/entities/badge.entity';
import { SearchService } from './services/search.service';
import { SearchController } from './controller/search.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity, BadgeEntity])],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
