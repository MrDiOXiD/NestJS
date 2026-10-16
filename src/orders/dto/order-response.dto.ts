import { ApiProperty } from '@nestjs/swagger';

import { OrderStatus } from '../../utils/common/order.enum';
import { OrderAction } from '../domain/order-status.rules';

/**
 * Explicit response shapes for admin order endpoints. They are built by `toOrderResponse`
 * (a whitelist), so a new column on UserEntity or OrderEntity can never leak into an API response by accident.
 */

export class OrderCustomerDto {
  @ApiProperty({ example: 20 }) id!: number;
  @ApiProperty({ example: 'johnadoe99' }) name!: string;
  @ApiProperty({ example: '' }) familyName!: string;
  @ApiProperty({ example: 'johnadoe99' }) username!: string;
  @ApiProperty({ example: 'john.doae@example.com' }) email!: string;
  @ApiProperty({ example: '09123456789' }) phoneNumber!: string;
}

export class OrderShippingDto {
  @ApiProperty({ example: 13 }) id!: number;
  @ApiProperty({ example: '+989131234567' }) phone!: string;
  @ApiProperty({ example: 'Hesam Mohammadi' }) name!: string;
  @ApiProperty({ example: 'Vali Asr St, No. 24, Unit 3' }) address!: string;
  @ApiProperty({ example: '1967834511' }) postalCode!: string;
  @ApiProperty({ example: 'Tehran' }) city!: string;
}

export class OrderDeliveryMethodDto {
  @ApiProperty({ example: 3 }) id!: number;
  @ApiProperty({ example: 'ارسال با تیپاکس', description: 'The carrier or pickup point chosen at checkout' }) label!: string;
  @ApiProperty({ enum: ['courier', 'pickup'], example: 'courier', description: 'courier = we send it, pickup = customer collects' })
  type!: string;
}

export class OrderLineProductDto {
  @ApiProperty({ example: 10 }) id!: number;
  @ApiProperty({ example: 'لامپ LED حبابی ۹ وات' }) title!: string;
  @ApiProperty({ example: '45000.00', description: 'Current product price, not the price at order time' }) price!: string;
}

export class OrderLineDto {
  @ApiProperty({ example: 22, description: 'Order line id' }) id!: number;
  @ApiProperty({ example: 2 }) order_quantity!: number;
  @ApiProperty({
    type: OrderLineProductDto,
    required: false,
    description: 'Only present on single-order endpoints, not in the list',
  })
  product?: OrderLineProductDto;
}

export class OrderUpdatedByDto {
  @ApiProperty({ example: 20 }) id!: number;
  @ApiProperty({ example: 'johnadoe99' }) name!: string;
  @ApiProperty({ example: 'johnadoe99' }) username!: string;
}

export class OrderResponseDto {
  @ApiProperty({ example: 12 }) id!: number;
  @ApiProperty({ example: '2026-09-06T21:49:02.302Z', description: 'When the order was placed (never changes)' })
  orderAt!: Date;
  @ApiProperty({ example: null, nullable: true, type: String, format: 'date-time' }) shippedAt!: Date | null;
  @ApiProperty({ example: null, nullable: true, type: String, format: 'date-time' }) deliveredAt!: Date | null;
  @ApiProperty({ example: '123456789012', nullable: true, type: String, description: 'Carrier tracking code (e.g. Tipax), set when the order is shipped' })
  trackingCode!: string | null;
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PROCESSING }) status!: string;
  @ApiProperty({ example: '110000.00', description: 'Grand total in Toman, delivery fee included' }) total_price!: string;
  @ApiProperty({ example: '65000' }) deliveryFee!: string;
  @ApiProperty({ type: OrderDeliveryMethodDto, nullable: true, description: 'null on legacy orders without a delivery method' })
  deliveryMethod!: OrderDeliveryMethodDto | null;
  @ApiProperty({ example: '2026-09-06T21:49:55.958Z', nullable: true, type: String, format: 'date-time' })
  paidAt!: Date | null;
  @ApiProperty({ example: '2026-09-15', description: 'YYYY-MM-DD' }) requestedDeliveryDate!: string;
  @ApiProperty({ enum: ['online', 'cod'], example: 'online' }) paymentMethod!: string;
  @ApiProperty({ type: OrderShippingDto, nullable: true, description: 'null on legacy orders created before addresses existed' })
  shippingAddress!: OrderShippingDto | null;
  @ApiProperty({ type: OrderCustomerDto, nullable: true }) user!: OrderCustomerDto | null;
  @ApiProperty({ type: [OrderLineDto] }) products!: OrderLineDto[];
  @ApiProperty({ type: OrderUpdatedByDto, nullable: true, description: 'Admin who last changed the status (single-order endpoints only)' })
  updatedBy!: OrderUpdatedByDto | null;
}

export class OrderDetailResponseDto extends OrderResponseDto {
  @ApiProperty({
    enum: OrderAction,
    isArray: true,
    example: [OrderAction.SHIP, OrderAction.CANCEL],
    description: 'Actions an admin may still perform. Empty once the order is delivered or cancelled.',
  })
  allowedActions!: OrderAction[];
}

export class CreateOrderResponseDto {
  @ApiProperty({ type: OrderResponseDto }) order!: OrderResponseDto;
  @ApiProperty({ example: 45000, description: 'Products only' }) totalPrice!: number;
  @ApiProperty({ example: 65000 }) deliveryFee!: number;
  @ApiProperty({ example: 110000, description: 'Products + delivery fee, what is charged' }) grandTotal!: number;
}
