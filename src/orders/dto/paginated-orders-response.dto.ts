import { ApiProperty } from '@nestjs/swagger';

import { OrderResponseDto } from './order-response.dto';

export class OrderListMetaDto {
  @ApiProperty({ example: 42, description: 'Orders matching ALL filters (including status)' })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 15 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { processing: 4, shipped: 2, delivered: 30, cancelled: 6 },
    description: 'Orders per status under every filter EXCEPT status, so status chips stay accurate while searching',
  })
  statusCounts!: Record<string, number>;
}

export class PaginatedOrdersResponseDto {
  @ApiProperty({ type: () => [OrderResponseDto] })
  items!: OrderResponseDto[];

  @ApiProperty({ type: OrderListMetaDto })
  meta!: OrderListMetaDto;
}
