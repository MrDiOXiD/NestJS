import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';

import { ProductEntity } from '../../products/entities/product.entity';
import { BadgeEntity } from '../../products/entities/badge.entity';
import { normalizeError } from '../../utils/errors/normalize-error.util';
import { SearchProductsQueryDto } from '../dto/search-products-query.dto';
import { SearchFacetsQueryDto } from '../dto/search-facets-query.dto';
import { SuggestQueryDto } from '../dto/suggest-query.dto';
import {
  FacetsResponseDto,
  SearchProductsResponseDto,
  SuggestResponseDto,
} from '../dto/search-response.dto';
import { SearchSort } from '../enums/search-sort.enum';
import { buildTsQuery, escapeLike, normalizeText } from '../utils/normalize';
import {
  FACET_CACHE_TTL_MS,
  FUZZY_FALLBACK_BELOW,
  WORD_SIMILARITY,
  discountActive,
  finalPrice,
} from '../utils/search-sql.util';

type FacetSkip = 'brand' | 'category' | 'price';

interface ParsedSearch {
  q: string; //        normalised query ('' when it has no usable tokens)
  tokens: string[]; // normalised words (max 5)
  tsq: string; //      prefix tsquery, e.g. "led:* & lamp:*"
  contains: string; // %escaped%
  prefix: string; //   escaped%
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly facetCache = new Map<string, { at: number; value: FacetsResponseDto }>();

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {}

  // ── Product search ────────────────────────────────────────────────────────

  async searchProducts(dto: SearchProductsQueryDto): Promise<SearchProductsResponseDto> {
    try {
      this.assertPriceRange(dto);
      const page = dto.page ?? 1;
      const limit = dto.limit ?? 24;
      const s = this.parse(dto.q);

      return await this.productRepository.manager.transaction(async (m) => {
        await this.setThreshold(m);

        // 1. exact match first; typo-tolerant fallback only when (almost) nothing matched
        const { fuzzy, total } = await this.resolveMode(m, dto, s);

        // 2. one page of items
        const qb = m.getRepository(ProductEntity).createQueryBuilder('p').select([
          'p.id', 'p.title', 'p.price', 'p.discount', 'p.discountStartDate', 'p.discountEndDate',
          'p.stock', 'p.brand', 'p.badges', 'p.productImage', 'p.isFeatured', 'p.categoryId', 'p.attributes',
        ]);
        this.applyFilters(qb, dto, s, [], fuzzy);
        this.applySort(qb, dto.sort ?? SearchSort.RELEVANCE, s, fuzzy);
        const rows = await qb.limit(limit).offset((page - 1) * limit).getMany();

        // 3. resolve badge ids -> badge objects (one query for the whole page)
        const badgeIds = [...new Set(rows.flatMap((r) => r.badges ?? []))];
        const badgeMap = new Map<number, BadgeEntity>();
        if (badgeIds.length > 0) {
          const badges = await m.getRepository(BadgeEntity).find({ where: { id: In(badgeIds), isActive: true } });
          badges.forEach((b) => badgeMap.set(b.id, b));
        }

        const now = Date.now();
        const items = rows.map((r) => {
          const price = Number(r.price);
          const discount = Number(r.discount);
          const active =
            discount > 0 &&
            (!r.discountStartDate || r.discountStartDate.getTime() <= now) &&
            (!r.discountEndDate || r.discountEndDate.getTime() >= now);
          return {
            id: r.id,
            title: r.title,
            brand: r.brand,
            categoryId: r.categoryId,
            image: r.productImage ?? null,
            price,
            discount: active ? discount : 0,
            finalPrice: active ? Math.round(price * (1 - discount / 100) * 100) / 100 : price,
            inStock: r.stock > 0,
            isFeatured: r.isFeatured,
            attributes: r.attributes,
            badges: (r.badges ?? []).map((id) => badgeMap.get(id)).filter((b): b is BadgeEntity => !!b),
          };
        });

        return {
          items,
          meta: { total, page, limit, totalPages: Math.ceil(total / limit), query: s.q || null, fuzzy },
          facets: dto.facets ? await this.computeFacets(m, dto, s, fuzzy) : undefined,
        };
      });
    } catch (error) {
      this.rethrow(error, 'Failed to search products');
    }
  }

  // ── Facets (own endpoint, cached) ─────────────────────────────────────────

  /** Sidebar filter counts. Call in parallel with searchProducts() — it runs on its own connection. */
  async getFacets(dto: SearchFacetsQueryDto): Promise<FacetsResponseDto> {
    try {
      this.assertPriceRange(dto);
      const s = this.parse(dto.q);
      const key = JSON.stringify([s.q, dto.categoryIds, dto.brands, dto.badgeIds, dto.minPrice, dto.maxPrice, dto.inStock, dto.onDiscount, dto.attr]);

      const hit = this.facetCache.get(key);
      if (hit && Date.now() - hit.at < FACET_CACHE_TTL_MS) return hit.value;

      const value = await this.productRepository.manager.transaction(async (m) => {
        await this.setThreshold(m);
        const { fuzzy } = await this.resolveMode(m, dto, s);
        return this.computeFacets(m, dto, s, fuzzy);
      });

      if (this.facetCache.size >= 300) this.facetCache.delete(this.facetCache.keys().next().value as string);
      this.facetCache.set(key, { at: Date.now(), value });
      return value;
    } catch (error) {
      this.rethrow(error, 'Failed to load search facets');
    }
  }

  // ── Autocomplete ──────────────────────────────────────────────────────────

  async suggest(dto: SuggestQueryDto): Promise<SuggestResponseDto> {
    try {
      const s = this.parse(dto.q);
      if (s.q.length < 2) return { products: [], brands: [] };
      const limit = dto.limit ?? 8;

      return await this.productRepository.manager.transaction(async (m) => {
        await this.setThreshold(m);

        const findProducts = (fuzzy: boolean) => {
          const qb = m
            .getRepository(ProductEntity)
            .createQueryBuilder('p')
            .select(['p.id', 'p.title', 'p.productImage', 'p.price', 'p.brand'])
            .where('p."isActive" = true')
            .andWhere(
              fuzzy ? `(p."search_text" ILIKE :contains OR :q <% p."search_text")` : `p."search_text" ILIKE :contains`,
              { contains: s.contains, q: s.q },
            )
            .orderBy(`(CASE WHEN p."search_text" ILIKE :prefix THEN 0 ELSE 1 END)`, 'ASC')
            .setParameter('prefix', s.prefix);
          if (fuzzy) qb.addOrderBy(`word_similarity(:q, p."search_text")`, 'DESC');
          return qb.addOrderBy('p."stock" > 0', 'DESC').limit(limit).getMany();
        };

        let products = await findProducts(false);
        if (products.length < 3 && s.q.length >= 3) products = await findProducts(true);

        const brands: { brand: string }[] = await m.query(
          `SELECT DISTINCT p."brand" AS brand FROM products p
            WHERE p."isActive" = true AND p."brand" IS NOT NULL AND fa_normalize(p."brand") ILIKE $1
            LIMIT 5`,
          [s.contains],
        );

        return {
          products: products.map((p) => ({
            id: p.id,
            title: p.title,
            image: p.productImage ?? null,
            price: Number(p.price),
            brand: p.brand,
          })),
          brands: brands.map((b) => b.brand),
        };
      });
    } catch (error) {
      this.rethrow(error, 'Failed to load suggestions');
    }
  }

  // ── Query building ────────────────────────────────────────────────────────

  private parse(raw?: string): ParsedSearch {
    const q = normalizeText(raw);
    const tsq = buildTsQuery(q);
    const tokens = q.split(' ').filter(Boolean).slice(0, 5);
    return { q: tsq ? q : '', tokens, tsq, contains: `%${escapeLike(q)}%`, prefix: `${escapeLike(q)}%` };
  }

  private setThreshold(m: EntityManager) {
    return m.query(`SELECT set_config('pg_trgm.word_similarity_threshold', $1, true)`, [WORD_SIMILARITY]);
  }

  private assertPriceRange(dto: Pick<SearchProductsQueryDto, 'minPrice' | 'maxPrice'>): void {
    if (dto.minPrice != null && dto.maxPrice != null && dto.minPrice > dto.maxPrice) {
      throw new BadRequestException('minPrice cannot be greater than maxPrice');
    }
  }

  /** Count with exact matching; if almost nothing matched, retry with typo tolerance. */
  private async resolveMode(m: EntityManager, dto: SearchProductsQueryDto, s: ParsedSearch) {
    const count = (fuzzy: boolean) => {
      const qb = m.getRepository(ProductEntity).createQueryBuilder('p');
      this.applyFilters(qb, dto, s, [], fuzzy);
      return qb.getCount();
    };
    const total = await count(false);
    if (s.q.length >= 3 && total < FUZZY_FALLBACK_BELOW) {
      const fuzzyTotal = await count(true);
      if (fuzzyTotal > total) return { fuzzy: true, total: fuzzyTotal };
    }
    return { fuzzy: false, total };
  }

  private applyFilters(
    qb: SelectQueryBuilder<ProductEntity>,
    dto: SearchProductsQueryDto,
    s: ParsedSearch,
    skip: FacetSkip[] = [],
    fuzzy = false,
  ): void {
    qb.where('p."isActive" = true');

    if (s.q) {
      qb.andWhere(
        `(p."search_vector" @@ to_tsquery('simple', :tsq)
          OR p."search_text" ILIKE :contains${fuzzy ? `\n          OR (${this.fuzzyTokens(qb, s)})` : ''})`,
        { tsq: s.tsq, contains: s.contains, q: s.q },
      );
    }
    if (dto.categoryIds?.length && !skip.includes('category')) {
      qb.andWhere('p."categoryId" IN (:...categoryIds)', { categoryIds: dto.categoryIds });
    }
    if (dto.brands?.length && !skip.includes('brand')) {
      qb.andWhere('p."brand" IN (:...brands)', { brands: dto.brands });
    }
    if (dto.badgeIds?.length) {
      const parts = dto.badgeIds.map((id, i) => {
        qb.setParameter(`badge${i}`, JSON.stringify([id]));
        return `p."badges" @> CAST(:badge${i} AS jsonb)`;
      });
      qb.andWhere(`(${parts.join(' OR ')})`);
    }
    if (!skip.includes('price')) {
      if (dto.minPrice != null) qb.andWhere(`${finalPrice('p')} >= :minPrice`, { minPrice: dto.minPrice });
      if (dto.maxPrice != null) qb.andWhere(`${finalPrice('p')} <= :maxPrice`, { maxPrice: dto.maxPrice });
    }
    if (dto.inStock) qb.andWhere('p."stock" > 0');
    if (dto.onDiscount) qb.andWhere(discountActive('p'));

    // dynamic attributes: AND between keys, OR between values; served by GIN(jsonb_path_ops)
    Object.entries(dto.attr ?? {})
      .slice(0, 10)
      .forEach(([key, raw], ki) => {
        const values = (Array.isArray(raw) ? raw : String(raw).split(','))
          .map((v) => String(v).trim())
          .filter(Boolean)
          .slice(0, 10);
        const ors: string[] = [];
        values.forEach((v, vi) => {
          // attributes hold string | number | boolean, and query strings are always strings -> try every variant
          const variants: (string | number | boolean)[] = [v];
          if (!Number.isNaN(Number(v))) variants.push(Number(v));
          if (v === 'true' || v === 'false') variants.push(v === 'true');
          variants.forEach((val, xi) => {
            const name = `attr_${ki}_${vi}_${xi}`;
            qb.setParameter(name, JSON.stringify({ [key]: val }));
            ors.push(`p."attributes" @> CAST(:${name} AS jsonb)`);
          });
        });
        if (ors.length > 0) qb.andWhere(`(${ors.join(' OR ')})`);
      });
  }

  /**
   * Typo-tolerant match: EVERY word must fuzzily match (trigram word-similarity, GIN-indexed).
   * Very short words (<3 chars) can't be fuzzy-matched reliably, so they must match literally.
   */
  private fuzzyTokens(qb: SelectQueryBuilder<ProductEntity>, s: ParsedSearch): string {
    const parts = s.tokens.map((t, i) => {
      if (t.length >= 3) {
        qb.setParameter(`fz${i}`, t);
        return `:fz${i} <% p."search_text"`;
      }
      qb.setParameter(`fl${i}`, `%${escapeLike(t)}%`);
      return `p."search_text" ILIKE :fl${i}`;
    });
    return parts.join(' AND ') || 'false';
  }

  private applySort(qb: SelectQueryBuilder<ProductEntity>, sort: SearchSort, s: ParsedSearch, fuzzy: boolean): void {
    switch (sort) {
      case SearchSort.PRICE_ASC:
        qb.orderBy(finalPrice('p'), 'ASC').addOrderBy('p."id"', 'DESC');
        return;
      case SearchSort.PRICE_DESC:
        qb.orderBy(finalPrice('p'), 'DESC').addOrderBy('p."id"', 'DESC');
        return;
      case SearchSort.NEWEST:
        qb.orderBy('p."createdAt"', 'DESC').addOrderBy('p."id"', 'DESC');
        return;
      case SearchSort.DISCOUNT:
        qb.orderBy(`(CASE WHEN ${discountActive('p')} THEN p."discount" ELSE 0 END)`, 'DESC').addOrderBy('p."createdAt"', 'DESC');
        return;
      case SearchSort.FEATURED:
        // createdAt tiebreaker keeps OFFSET pagination stable (same reasoning as ProductsService.findAll)
        qb.orderBy('p."isFeatured"', 'DESC').addOrderBy('p."createdAt"', 'DESC');
        return;
      case SearchSort.RELEVANCE:
      default:
        if (!s.q) {
          // no text query: same order as GET /products?sort=featured (uses IDX_products_isFeatured_createdAt)
          qb.orderBy('p."isFeatured"', 'DESC').addOrderBy('p."createdAt"', 'DESC');
          return;
        }
        qb.orderBy(
          `(ts_rank_cd(p."search_vector", to_tsquery('simple', :tsq), 32) * 2
            ${fuzzy ? '+ word_similarity(:q, p."search_text")' : ''}
            + (CASE WHEN p."search_text" ILIKE :prefix THEN 0.5 ELSE 0 END)
            + (CASE WHEN p."stock" > 0 THEN 0.1 ELSE 0 END)
            + (CASE WHEN p."isFeatured" THEN 0.05 ELSE 0 END))`,
          'DESC',
        )
          .addOrderBy('p."id"', 'DESC')
          .setParameter('prefix', s.prefix);
    }
  }

  // ── Facets ────────────────────────────────────────────────────────────────

  /**
   * Each facet is computed over the result set filtered by EVERYTHING except its own
   * dimension, so picking a brand doesn't make the other brands vanish from the sidebar.
   */
  private async computeFacets(
    m: EntityManager,
    dto: SearchProductsQueryDto,
    s: ParsedSearch,
    fuzzy: boolean,
  ): Promise<FacetsResponseDto> {
    const run = async (skip: FacetSkip[], build: (idsSql: string) => string) => {
      const qb = m.getRepository(ProductEntity).createQueryBuilder('p').select('p.id');
      this.applyFilters(qb, dto, s, skip, fuzzy);
      const [sql, params] = qb.getQueryAndParameters();
      return m.query(build(sql), params);
    };

    // sequential on purpose: every query shares the transaction's single connection
    const brands = await run(['brand'], (ids) => `
      SELECT f."brand" AS value, COUNT(*)::int AS count FROM products f
       WHERE f."id" IN (${ids}) AND f."brand" IS NOT NULL
       GROUP BY f."brand" ORDER BY count DESC, value LIMIT 30`);
    const categories = await run(['category'], (ids) => `
      SELECT f."categoryId" AS id, COUNT(*)::int AS count FROM products f
       WHERE f."id" IN (${ids}) AND f."categoryId" IS NOT NULL
       GROUP BY f."categoryId" ORDER BY count DESC LIMIT 50`);
    const price = await run(['price'], (ids) => `
      SELECT MIN(${finalPrice('f')}) AS min, MAX(${finalPrice('f')}) AS max FROM products f
       WHERE f."id" IN (${ids})`);
    const badges = await run([], (ids) => `
      SELECT b."id", b."key", b."label", b."color", b."textColor", COUNT(*)::int AS count
        FROM products f
        CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(f."badges") = 'array' THEN f."badges" ELSE '[]'::jsonb END) e
        JOIN badges b ON b."id" = e.value::int AND b."isActive" = true
       WHERE f."id" IN (${ids})
       GROUP BY b."id" ORDER BY count DESC`);
    const attributes = await run([], (ids) => `
      SELECT kv.key, kv.value, COUNT(*)::int AS count
        FROM products f
        CROSS JOIN LATERAL jsonb_each_text(CASE WHEN jsonb_typeof(f."attributes") = 'object' THEN f."attributes" ELSE '{}'::jsonb END) kv
       WHERE f."id" IN (${ids})
       GROUP BY kv.key, kv.value ORDER BY count DESC LIMIT 200`);

    const attrs: Record<string, { value: string; count: number }[]> = {};
    for (const r of attributes) (attrs[r.key] ??= []).push({ value: r.value, count: r.count });

    return {
      brands,
      categories,
      price: {
        min: price[0]?.min != null ? Number(price[0].min) : null,
        max: price[0]?.max != null ? Number(price[0].max) : null,
      },
      badges,
      attributes: attrs,
    };
  }

  /** Re-throw known HTTP errors untouched; log + wrap everything else (same pattern as ProductsService). */
  private rethrow(error: unknown, message: string): never {
    if (error instanceof HttpException) throw error;
    const err = normalizeError(error);
    this.logger.error(err.message, err.stack);
    throw new InternalServerErrorException(message);
  }
}
