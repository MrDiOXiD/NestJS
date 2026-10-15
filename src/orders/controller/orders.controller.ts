import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiBody,
  ApiExtraModels,
} from '@nestjs/swagger';

import { OrdersService } from '../services/orders.service';
import { OrdersListService } from '../services/orders-list.service';
import { FindOrdersQueryDto } from '../dto/find-orders-query.dto';
import { PaginatedOrdersResponseDto } from '../dto/paginated-orders-response.dto';
import { CreateOrderResponseDto, OrderDetailResponseDto } from '../dto/order-response.dto';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderStatus } from '../dto/update-order-status.dto';
import { CreateShippingDto } from '../dto/shipping.dto';
import { OrderProductDto } from '../dto/order-product.dto';
import { CurrentUser } from '../../utils/decorators/currentUser.decorator';
import { AuthenticationGuard } from '../../utils/guard/auth.guard';
import { Roles } from '../../utils/common/Roles.enum';
import { AuthorizedGuard } from '../../utils/guard/authorized-role.guard';
import { UserEntity } from '@/users/entities/user.entity';
import { OrderSummaryResponseDto } from '../dto/order-summary-response.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@ApiExtraModels(CreateShippingDto, OrderProductDto)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersListService: OrdersListService,
  ) {}

  @Post()
  @UseGuards(AuthenticationGuard)
  @ApiOperation({
    summary: 'Create a new order',
    description:
      'Creates an order for the current user, including a shipping address and the list of ordered products.',
  })
  @ApiBody({
    type: CreateOrderDto,
    examples: {
      savedAddress: {
        summary: 'Saved address, pay online',
        value: {
          addressId: 4,
          deliveryMethodId: 3,
          requestedDeliveryDate: '2026-10-20',
          paymentMethod: 'online',
          orderProducts: [{ productId: 101, order_quantity: 2 }],
        },
      },
      newAddress: {
        summary: 'One-off address, cash on delivery',
        value: {
          shippingAddress: {
            phone: '+989131234567',
            name: 'Hesam Mohammadi',
            postalCode: '1967834511',
            address: 'Vali Asr St, No. 24, Unit 3',
            city: 'Tehran',
          },
          deliveryMethodId: 3,
          requestedDeliveryDate: '2026-10-20',
          paymentMethod: 'cod',
          orderProducts: [{ productId: 101, order_quantity: 1 }],
        },
      },
    },
  })
  @ApiCreatedResponse({ type: CreateOrderResponseDto, description: 'The order has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid input data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Token missing or invalid.' })
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() currentUser: UserEntity,
  ) {
    return await this.ordersService.createOrder(createOrderDto, currentUser);
  }

  @Get()
  @UseGuards(AuthenticationGuard, AuthorizedGuard([Roles.ADMIN]))
  @ApiOperation({
    summary: 'List orders (paginated)',
    description:
      'Paginated, filterable, sortable list of orders. Requires the ADMIN role. ' +
      '`meta.statusCounts` ignores the status filter so status chips stay accurate while searching.',
  })
  @ApiOkResponse({ type: PaginatedOrdersResponseDto, description: 'Successfully retrieved a page of orders.' })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid query parameter (e.g. limit > 100, unknown status).' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Token missing or invalid.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User does not have ADMIN privileges.' })
  async findAllOrders(@Query() query: FindOrdersQueryDto): Promise<PaginatedOrdersResponseDto> {
    return await this.ordersListService.list(query);
  }

  @Get(':id')
  @UseGuards(AuthenticationGuard, AuthorizedGuard([Roles.ADMIN]))
  @ApiOperation({
    summary: 'Retrieve a specific order by ID',
    description: 'Returns full order details for a single order. Requires the ADMIN role.',
  })
  @ApiParam({ name: 'id', type: 'integer', description: 'The unique identifier of the order', example: 1 })
  @ApiOkResponse({
    type: OrderDetailResponseDto,
    description: 'Successfully retrieved the order. `allowedActions` lists what can still be done to it.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized. Token missing or invalid.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User does not have ADMIN privileges.' })
  @ApiResponse({ status: 404, description: 'Not Found. Order with the specified ID does not exist.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.getOrderDetail(id);
  }

  @Put(':id')
  @UseGuards(AuthenticationGuard, AuthorizedGuard([Roles.ADMIN]))
  @ApiOperation({
    summary: 'Update an order status',
    description:
      'Moves an order forward: SHIPPED (only from processing) or DELIVERED (only from shipped, deducts stock). Requires the ADMIN role.',
  })
  @ApiParam({ name: 'id', type: 'integer', description: 'The unique identifier of the order to update', example: 1 })
  @ApiBody({
    type: UpdateOrderStatus,
    examples: {
      ship: { summary: 'Mark as shipped (from processing)', value: { status: 'shipped' } },
      deliver: { summary: 'Mark as delivered (from shipped, deducts stock)', value: { status: 'delivered' } },
    },
  })
  @ApiOkResponse({ type: OrderDetailResponseDto, description: 'Successfully updated the order status.' })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid payload.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Token missing or invalid.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User does not have ADMIN privileges.' })
  @ApiResponse({ status: 404, description: 'Not Found. Order does not exist.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict. The order status does not allow this transition, or stock is insufficient.',
    example: { statusCode: 409, message: 'Cannot deliver an order that is processing. Allowed actions: ship, cancel.', error: 'Conflict' },
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderStatus,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.ordersService.updateOrderStatus(id, updateOrderDto, user);
  }

  @Put('cancel/:id')
  @UseGuards(AuthenticationGuard, AuthorizedGuard([Roles.ADMIN]))
  @ApiOperation({
    summary: 'Cancel an order',
    description:
      'Cancels an order. Only processing orders can be cancelled (nothing has shipped or been deducted from stock yet). Cancelling an already cancelled order is a no-op. Requires the ADMIN role.',
  })
  @ApiParam({ name: 'id', type: 'integer', description: 'The unique identifier of the order to cancel', example: 1 })
  @ApiOkResponse({ type: OrderDetailResponseDto, description: 'Successfully cancelled the order.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Token missing or invalid.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User does not have ADMIN privileges.' })
  @ApiResponse({ status: 404, description: 'Not Found. Order does not exist.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict. Shipped or delivered orders cannot be cancelled.',
    example: { statusCode: 409, message: 'Cannot cancel an order that is shipped. Allowed actions: deliver.', error: 'Conflict' },
  })
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.ordersService.cancelOrder(id, user);
  }

@Get('mine/:id(\\d+)')
@UseGuards(AuthenticationGuard)
@ApiBearerAuth()
@ApiOperation({ summary: "Get one of the current user's own orders (summary)" })
@ApiOkResponse({ type: OrderSummaryResponseDto })
@ApiResponse({ status: 404, description: 'Not Found. No such order on this account.' })
async findMyOrder(
  @Param('id', ParseIntPipe) id: number,
  @CurrentUser() user: UserEntity,
) {
  return this.ordersService.getOrderSummaryForUser(id, user.id);
}




}
