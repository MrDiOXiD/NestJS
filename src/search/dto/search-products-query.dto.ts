import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { SearchSort } from '../enums/search-sort.enum';
import { parseIdList } from '../../products/utils/parse-id-list.transform';
import { parseAttrFilter, parseBooleanFlag, parseStringList, trimString } from '../utils/query-transforms';

export class SearchProductsQueryDto {
  @ApiPropertyOptional({
    example: 'لامپ led ۹ وات',
    description: 'Free-text query. Typo tolerant and Persian/Arabic normalised (ي/ك, digits, نیم‌فاصله). Matches title, brand, description and attributes.',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2],
    description: 'Category ids. Repeat the param (?categoryIds=1&categoryIds=2) or comma-separate (?categoryIds=1,2).',
  })
  @IsOptional()
  @Transform(parseIdList)
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  categoryIds?: number[];

  @ApiPropertyOptional({
    type: [String],
    example: ['پارس شهاب', 'نور'],
    description: 'Exact brand names (use the values from GET /search/facets). Repeat the param or comma-separate.',
  })
  @IsOptional()
  @Transform(parseStringList)
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  brands?: string[];

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 3],
    description: 'Badge ids (see GET /badges). Matches products that have ANY of them.',
  })
  @IsOptional()
  @Transform(parseIdList)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  badgeIds?: number[];

  @ApiPropertyOptional({ type: Number, example: 10000, description: 'Minimum FINAL price (after an active discount).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ type: Number, example: 500000, description: 'Maximum FINAL price (after an active discount).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ type: Boolean, example: true, description: 'Only products with stock > 0.' })
  @IsOptional()
  @Transform(parseBooleanFlag)
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ type: Boolean, example: true, description: 'Only products with a discount that is running right now.' })
  @IsOptional()
  @Transform(parseBooleanFlag)
  @IsBoolean()
  onDiscount?: boolean;

  @ApiPropertyOptional({
    type: String,
    example: '{"color":"white","power":["9W","12W"]}',
    description:
      'Dynamic attribute filters (products.attributes) as a JSON object: AND between keys, OR between values. ' +
      'Use the keys/values from GET /search/facets. Must be URL-encoded by the client.',
  })
  @IsOptional()
  @Transform(parseAttrFilter)
  @IsObject({ message: 'attr must be a JSON object, e.g. {"color":"white","power":["9W","12W"]}' })
  attr?: Record<string, string | number | boolean | (string | number | boolean)[]>;

  @ApiPropertyOptional({
    enum: SearchSort,
    default: SearchSort.RELEVANCE,
    description:
      "'relevance' ranks by match quality (falls back to featured + newest when there is no q). Price sorts use the FINAL price.",
  })
  @IsOptional()
  @IsEnum(SearchSort)
  sort?: SearchSort = SearchSort.RELEVANCE;

  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1, description: '1-indexed page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number = 1;

  @ApiPropertyOptional({ type: Number, default: 24, minimum: 1, maximum: 100, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 24;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      'Embed facets in this response. Prefer calling GET /search/facets in parallel — it is cached and keeps the list fast.',
  })
  @IsOptional()
  @Transform(parseBooleanFlag)
  @IsBoolean()
  facets?: boolean = false;
}
