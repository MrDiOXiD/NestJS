/* eslint-disable prettier/prettier */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderStatus } from '../../utils/common/order.enum';

export class UpdateOrderStatus {
  @ApiProperty({
    description: 'New status to transition the order to. Only forward transitions to SHIPPED or DELIVERED are allowed here.',
    enum: [OrderStatus.SHIPPED, OrderStatus.DELIVERED],
    example: OrderStatus.SHIPPED,
  })
  @IsNotEmpty()
  @IsString()
  @IsIn([OrderStatus.SHIPPED, OrderStatus.DELIVERED])
  status!: OrderStatus;

  @ApiPropertyOptional({
    description: 'Carrier tracking code (کد رهگیری), e.g. from Tipax. Only accepted together with status "shipped".',
    example: '123456789012',
    maxLength: 50,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(50)
  trackingCode?: string;
}
