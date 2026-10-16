import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BadgeEntity } from '../../products/entities/badge.entity';

// Response shapes — used for Swagger and as service return types.

export class SearchProductItemDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'لامپ LED حبابی ۹ وات' }) title!: string;
  @ApiProperty({ example: 'پارس شهاب', nullable: true, type: String }) brand!: string | null;
  @ApiProperty({ example: 1, nullable: true, type: Number }) categoryId!: number | null;
  @ApiProperty({ example: 'https://bucket.example.com/products/167-abc.jpg', nullable: true, type: String }) image!: string | null;
  @ApiProperty({ example: 45000, description: 'Original price' }) price!: number;
  @ApiProperty({ example: 22, description: 'Discount % that is active RIGHT NOW (0 when none / expired / not started)' }) discount!: number;
  @ApiProperty({ example: 35100, description: 'Price after the active discount' }) finalPrice!: number;
  @ApiProperty({ example: true }) inStock!: boolean;
  @ApiProperty({ example: false }) isFeatured!: boolean;
  @ApiPropertyOptional({ example: { color: 'white', power: '9W' }, nullable: true, type: 'object', additionalProperties: true })
  attributes!: Record<string, string | number | boolean> | null;
  @ApiProperty({ type: () => [BadgeEntity], description: 'Resolved badge objects (active badges only)' }) badges!: BadgeEntity[];
}

export class SearchMetaDto {
  @ApiProperty({ example: 128 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 24 }) limit!: number;
  @ApiProperty({ example: 6 }) totalPages!: number;
  @ApiProperty({ example: 'لامپ', nullable: true, type: String, description: 'Normalised query actually searched' }) query!: string | null;
  @ApiProperty({ example: false, description: 'true when exact matching found (almost) nothing and typo-tolerant matching was used' }) fuzzy!: boolean;
}

export class FacetBrandDto {
  @ApiProperty({ example: 'پارس شهاب' }) value!: string;
  @ApiProperty({ example: 12 }) count!: number;
}

export class FacetCategoryDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 34 }) count!: number;
}

export class FacetPriceRangeDto {
  @ApiProperty({ example: 12000, nullable: true, type: Number }) min!: number | null;
  @ApiProperty({ example: 890000, nullable: true, type: Number }) max!: number | null;
}

export class FacetBadgeDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'bestseller' }) key!: string;
  @ApiProperty({ example: 'پرفروش' }) label!: string;
  @ApiProperty({ example: '#F59E0B' }) color!: string;
  @ApiProperty({ example: '#FFFFFF' }) textColor!: string;
  @ApiProperty({ example: 7 }) count!: number;
}

export class FacetsResponseDto {
  @ApiProperty({ type: [FacetBrandDto], description: 'Counts ignore the brand filter, so other brands stay visible' }) brands!: FacetBrandDto[];
  @ApiProperty({ type: [FacetCategoryDto], description: 'Counts ignore the category filter' }) categories!: FacetCategoryDto[];
  @ApiProperty({ type: FacetPriceRangeDto, description: 'Final-price range, ignores the price filter' }) price!: FacetPriceRangeDto;
  @ApiProperty({ type: [FacetBadgeDto] }) badges!: FacetBadgeDto[];
  @ApiProperty({
    type: 'object',
    description: 'attribute key -> values with counts',
    additionalProperties: {
      type: 'array',
      items: { type: 'object', properties: { value: { type: 'string' }, count: { type: 'number' } } },
    },
    example: { color: [{ value: 'white', count: 9 }, { value: 'yellow', count: 3 }], power: [{ value: '9W', count: 5 }] },
  })
  attributes!: Record<string, { value: string; count: number }[]>;
}

export class SearchProductsResponseDto {
  @ApiProperty({ type: [SearchProductItemDto] }) items!: SearchProductItemDto[];
  @ApiProperty({ type: SearchMetaDto }) meta!: SearchMetaDto;
  @ApiPropertyOptional({ type: FacetsResponseDto, description: 'Only present when ?facets=true' }) facets?: FacetsResponseDto;
}

export class SuggestProductDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'لامپ LED حبابی ۹ وات' }) title!: string;
  @ApiProperty({ example: 'https://bucket.example.com/products/167-abc.jpg', nullable: true, type: String }) image!: string | null;
  @ApiProperty({ example: 45000 }) price!: number;
  @ApiProperty({ example: 'پارس شهاب', nullable: true, type: String }) brand!: string | null;
}

export class SuggestResponseDto {
  @ApiProperty({ type: [SuggestProductDto] }) products!: SuggestProductDto[];
  @ApiProperty({ type: [String], example: ['پارس شهاب'] }) brands!: string[];
}
