import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsBoolean, IsEnum, IsInt, IsNumber, IsObject,
  IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';

export enum SearchSort {
  RELEVANCE = 'relevance',
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  FEATURED = 'featured',
  DISCOUNT = 'discount',
}

const toList = ({ value }: { value: unknown }) =>
  value === undefined || value === ''
    ? undefined
    : (Array.isArray(value) ? value : String(value).split(','))
        .map((s) => String(s).trim())
        .filter(Boolean);

const toIntList = ({ value }: { value: unknown }) =>
  toList({ value })?.map((s) => Number(s));

const toBool = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : ['true', '1', true].includes(value as any);

export class SearchProductsDto {
  @ApiPropertyOptional({ example: 'لامپ led ۹ وات', description: 'Free-text query (typo tolerant, Persian-normalised)' })
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ type: [Number], example: '1,2', description: 'Comma separated or repeated' })
  @IsOptional() @Transform(toIntList) @IsInt({ each: true }) @ArrayMaxSize(50)
  categoryIds?: number[];

  @ApiPropertyOptional({ type: [String], example: 'پارس شهاب,نور' })
  @IsOptional() @Transform(toList) @IsString({ each: true }) @ArrayMaxSize(30)
  brands?: string[];

  @ApiPropertyOptional({ type: [Number], example: '1,3', description: 'Badge ids — matches products having ANY of them' })
  @IsOptional() @Transform(toIntList) @IsInt({ each: true }) @ArrayMaxSize(20)
  badgeIds?: number[];

  @ApiPropertyOptional({ example: 10000, description: 'Applies to the FINAL price (after active discount)' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean()
  onDiscount?: boolean;

  @ApiPropertyOptional({
    example: { color: 'white', power: ['9W', '12W'] },
    description: 'Dynamic attribute filters: ?attr[color]=white&attr[power]=9W,12W (AND between keys, OR between values)',
  })
  @IsOptional() @IsObject()
  attr?: Record<string, string | string[]>;

  @ApiPropertyOptional({ enum: SearchSort, default: SearchSort.RELEVANCE })
  @IsOptional() @IsEnum(SearchSort)
  sort?: SearchSort;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000)
  page?: number = 1;

  @ApiPropertyOptional({ default: 24 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 24;

  @ApiPropertyOptional({ default: false, description: 'Inline facets in the list response. Prefer GET /search/facets in parallel — it is cached and keeps the list fast.' })
  @IsOptional() @Transform(toBool) @IsBoolean()
  facets?: boolean = false;
}

export class SuggestDto {
  @ApiPropertyOptional({ example: 'لام' })
  @IsString() @MaxLength(60)
  q!: string;

  @ApiPropertyOptional({ default: 8 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20)
  limit?: number = 8;
}
