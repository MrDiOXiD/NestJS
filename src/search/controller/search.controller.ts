import { Controller, Get, Query } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SearchService } from '../services/search.service';
import { SearchProductsQueryDto } from '../dto/search-products-query.dto';
import { SearchFacetsQueryDto } from '../dto/search-facets-query.dto';
import { SuggestQueryDto } from '../dto/suggest-query.dto';
import {
  FacetsResponseDto,
  SearchProductsResponseDto,
  SuggestResponseDto,
} from '../dto/search-response.dto';

const BAD_QUERY_EXAMPLE = {
  statusCode: 400,
  message: ['limit must not be greater than 100'],
  error: 'Bad Request',
};

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('products')
  @ApiOperation({
    summary: 'Search products',
    description:
      'Full-text + typo-tolerant search with filters, sorting and pagination. Only active products are returned. ' +
      'Prices are filtered/sorted by the FINAL price (after an active discount). ' +
      'Call GET /search/facets in parallel to fill the filter sidebar.',
  })
  @ApiOkResponse({ type: SearchProductsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query params (or minPrice > maxPrice)', example: BAD_QUERY_EXAMPLE })
  @ApiInternalServerErrorResponse({ description: 'Search failed' })
  searchProducts(@Query() query: SearchProductsQueryDto): Promise<SearchProductsResponseDto> {
    return this.searchService.searchProducts(query);
  }

  @Get('facets')
  @CacheTTL(60_000)
  @ApiOperation({
    summary: 'Filter facets for the sidebar',
    description:
      'Brand / category / price-range / badge / attribute counts for the SAME filters as /search/products ' +
      '(no page / limit / sort). Each facet ignores its own filter so other options stay visible. Cached for 60s.',
  })
  @ApiOkResponse({ type: FacetsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query params', example: BAD_QUERY_EXAMPLE })
  @ApiInternalServerErrorResponse({ description: 'Failed to load facets' })
  getFacets(@Query() query: SearchFacetsQueryDto): Promise<FacetsResponseDto> {
    return this.searchService.getFacets(query);
  }

  @Get('suggest')
  @CacheTTL(30_000)
  @ApiOperation({
    summary: 'Search-bar autocomplete',
    description: 'Up to `limit` product suggestions plus matching brand names. Returns empty lists for queries shorter than 2 characters. Debounce on the client (~250ms).',
  })
  @ApiOkResponse({ type: SuggestResponseDto })
  @ApiBadRequestResponse({ description: 'q is missing or too long', example: { statusCode: 400, message: ['q should not be empty'], error: 'Bad Request' } })
  @ApiInternalServerErrorResponse({ description: 'Failed to load suggestions' })
  suggest(@Query() query: SuggestQueryDto): Promise<SuggestResponseDto> {
    return this.searchService.suggest(query);
  }
}
