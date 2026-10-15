import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchProductsDto, SuggestDto } from './dto/search-products.dto';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('products')
  @ApiOperation({ summary: 'Full product search: text + filters + sort + pagination + facets' })
  products(@Query() dto: SearchProductsDto) {
    return this.search.search(dto);
  }

  @Get('facets')
  @ApiOperation({ summary: 'Sidebar facets (brands, categories, price range, badges, attributes) for the same filters. Cached 60s.' })
  facets(@Query() dto: SearchProductsDto) {
    return this.search.getFacets(dto);
  }

  @Get('suggest')
  @ApiOperation({ summary: 'Search-bar autocomplete (products + brands)' })
  suggest(@Query() dto: SuggestDto) {
    return this.search.suggest(dto);
  }
}
