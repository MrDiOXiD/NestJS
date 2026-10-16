import { OmitType } from '@nestjs/swagger';
import { SearchProductsQueryDto } from './search-products-query.dto';

/** Same filters as GET /search/products, without the list-only params (sort, page, limit, facets). */
export class SearchFacetsQueryDto extends OmitType(SearchProductsQueryDto, ['sort', 'page', 'limit', 'facets'] as const) {}
