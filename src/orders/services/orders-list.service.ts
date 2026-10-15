import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';

import { OrderEntity } from '../entities/order.entity';
import { FindOrdersQueryDto } from '../dto/find-orders-query.dto';
import { PaginatedOrdersResponseDto } from '../dto/paginated-orders-response.dto';
import { OrderSort } from '../enums/order-sort.enum';
import { toOrderResponse } from '../mappers/order.mapper';
import { OrderStatus } from '../../utils/common/order.enum';

const SORT_COLUMNS: Record<OrderSort, [column: string, direction: 'ASC' | 'DESC']> = {
  [OrderSort.NEWEST]: ['order.orderAt', 'DESC'],
  [OrderSort.OLDEST]: ['order.orderAt', 'ASC'],
  [OrderSort.TOTAL_DESC]: ['order.total_price', 'DESC'],
  [OrderSort.TOTAL_ASC]: ['order.total_price', 'ASC'],
};

/** Up to this many digits a numeric search is treated as an order id, beyond it as a phone number. */
const MAX_ORDER_ID_DIGITS = 6;

// ۰-۹ (U+06F0) and ٠-٩ (U+0660) -> 0-9, so a Persian keyboard works in the search box
const normalizeDigits = (text: string): string =>
  text
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));

/** Escapes LIKE wildcards so a search for "50%" does not match everything. */
const escapeLike = (text: string): string => text.replace(/[\\%_]/g, '\\$&');

/**
 * Read-side of orders: the paginated, filterable admin list.
 * Kept apart from OrdersService (create / status changes) so each stays small.
 */
@Injectable()
export class OrdersListService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {}

  async list(query: FindOrdersQueryDto): Promise<PaginatedOrdersResponseDto> {
    const { page, limit, sort } = query;

    const listQuery = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.shippingAddress', 'shippingAddress')
      .leftJoinAndSelect('order.user', 'customer')
      .leftJoinAndSelect('order.products', 'products');
    this.applyFilters(listQuery, query, { includeStatus: true });

    const [sortColumn, sortDirection] = SORT_COLUMNS[sort];
    listQuery
      .orderBy(sortColumn, sortDirection)
      .addOrderBy('order.id', 'DESC') // stable order when the sort column ties
      .skip((page - 1) * limit)
      .take(limit);

    const [[items, total], statusCounts] = await Promise.all([
      listQuery.getManyAndCount(),
      this.countByStatus(query),
    ]);

    return {
      items: items.map(toOrderResponse),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), statusCounts },
    };
  }

  /** Per-status counts under every filter except status itself. */
  private async countByStatus(query: FindOrdersQueryDto): Promise<Record<string, number>> {
    const countQuery = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.shippingAddress', 'shippingAddress')
      .leftJoin('order.user', 'customer');
    this.applyFilters(countQuery, query, { includeStatus: false });

    const rows = await countQuery
      .select('order.status', 'status')
      .addSelect('COUNT(order.id)', 'count')
      .groupBy('order.status')
      .getRawMany<{ status: string; count: string }>();

    // Every known status is present (0 when empty) so the UI never has to guess
    const counts: Record<string, number> = {};
    for (const status of Object.values(OrderStatus)) counts[status] = 0;
    for (const row of rows) counts[row.status] = Number(row.count);
    return counts;
  }

  private applyFilters(
    qb: SelectQueryBuilder<OrderEntity>,
    query: FindOrdersQueryDto,
    { includeStatus }: { includeStatus: boolean },
  ): void {
    if (includeStatus && query.status) {
      qb.andWhere('order.status = :status', { status: query.status });
    }
    if (query.paymentMethod) {
      qb.andWhere('order.paymentMethod = :paymentMethod', { paymentMethod: query.paymentMethod });
    }
    if (query.paid !== undefined) {
      qb.andWhere(query.paid ? 'order.paidAt IS NOT NULL' : 'order.paidAt IS NULL');
    }
    if (query.q) {
      this.applySearch(qb, query.q);
    }
  }

  private applySearch(qb: SelectQueryBuilder<OrderEntity>, rawSearch: string): void {
    const search = normalizeDigits(rawSearch.trim()).replace(/^#/, '');
    if (!search) return;

    if (/^\d+$/.test(search)) {
      if (search.length <= MAX_ORDER_ID_DIGITS) {
        qb.andWhere('order.id = :orderId', { orderId: Number(search) });
      } else {
        qb.andWhere(
          new Brackets((phone) =>
            phone
              .where('customer.phoneNumber LIKE :phone', { phone: `%${search}%` })
              .orWhere('shippingAddress.phone LIKE :phone', { phone: `%${search}%` }),
          ),
        );
      }
      return;
    }

    const like = `%${escapeLike(search)}%`;
    qb.andWhere(
      new Brackets((text) =>
        text
          .where('customer.name ILIKE :like', { like })
          .orWhere('customer.familyName ILIKE :like', { like })
          .orWhere('customer.username ILIKE :like', { like })
          .orWhere('customer.email ILIKE :like', { like })
          .orWhere('shippingAddress.name ILIKE :like', { like }),
      ),
    );
  }
}
