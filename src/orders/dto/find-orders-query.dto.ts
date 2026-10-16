import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { OrderStatus } from '../../utils/common/order.enum';
import { OrderSort } from '../enums/order-sort.enum';

/** Query-string booleans arrive as the strings "true" / "false". */
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class FindOrdersQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 15, minimum: 1, maximum: 100, example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 15;

  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PROCESSING, description: 'Filter by order status' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: ['online', 'cod'], example: 'online' })
  @IsOptional()
  @IsIn(['online', 'cod'])
  paymentMethod?: 'online' | 'cod';

  @ApiPropertyOptional({ type: Boolean, example: false, description: 'true = paid orders only, false = unpaid only' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  paid?: boolean;

  @ApiPropertyOptional({
    example: 'amir',
    maxLength: 100,
    description:
      'Search. Up to 6 digits = exact order id, 7+ digits = phone number, anything else = customer name / username / email.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: OrderSort, default: OrderSort.NEWEST, example: OrderSort.NEWEST })
  @IsOptional()
  @IsEnum(OrderSort)
  sort: OrderSort = OrderSort.NEWEST;
}
