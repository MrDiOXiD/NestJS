import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { CreateOrderDto } from "../dto/create-order.dto";
import { OrderEntity } from "../entities/order.entity";
import { ShippingEntity } from "../entities/shipping.entity";
// NOTE: adjust this import to match the real path/name of your
// order-line-item entity in this codebase (the one referenced by
// OrderEntity.products). It was not included in what was shared,
// so the name/path below is a best guess and may need correcting.
import { OrderProductDto } from "../dto/order-product.dto";
import { UpdateOrderStatus } from "../dto/update-order-status.dto";
import { UserEntity } from "@/users/entities/user.entity";
import { AuditService } from "../../audit/audit.services";
import { OrderStatus } from "../../utils/common/order.enum";
import { OrderStockService } from "./order-stock.service";
import { toOrderResponse } from "../mappers/order.mapper";
import { CreateOrderResponseDto, OrderDetailResponseDto } from "../dto/order-response.dto";
import {
  ACTION_FOR_STATUS,
  ORDER_TRANSITIONS,
  OrderAction,
  assertCanTransition,
  getAllowedActions,
} from "../domain/order-status.rules";
import { normalizeError } from "../../utils/errors/normalize-error.util";
import { CreateShippingDto } from "../dto/shipping.dto";
import { ProductEntity } from "@/products/entities/product.entity";
import { ProductsService } from "@/products/services/products.service";
import { OrderProductsEntity } from "../entities/order-product.entity";
import { DeliveryMethodsService } from "@/delivery/services/delivery-methods.service";
import { UserAddressEntity } from "@/addressess/entities/user-address.entity";
import { OrderSummaryResponseDto } from "../dto/order-summary-response.dto";

@Injectable()
export class OrdersService {
  async setPaymentMethod(orderId: number, method: "online" | "cod"): Promise<void> {
    await this.orderRepository.update({ id: orderId }, { paymentMethod: method });
  }

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    // Fixed: this parameter had both @InjectEntityManager() and
    // @InjectRepository(ProductEntity) stacked on it, which is invalid —
    // it was being injected as an EntityManager, not a Repository, so the
    // ProductEntity decorator was silently wrong and could throw at
    // bootstrap depending on provider registration order.
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly auditService: AuditService,
    private readonly productServices: ProductsService,

    @InjectRepository(UserAddressEntity)
    private readonly addressRepository: Repository<UserAddressEntity>,
    private readonly deliveryMethodsService: DeliveryMethodsService,
    private readonly orderStockService: OrderStockService,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto, user: UserEntity): Promise<CreateOrderResponseDto> {
    const totalOrderPrice = await this.calculateTotalPrice(createOrderDto.orderProducts);

    // Resolves EITHER a saved addressId OR a one-off shippingAddress —
    // matches what the checkout UI actually offers (pick a saved card,
    // or type a new one).
    const shippingEntity = await this.resolveShippingEntity(createOrderDto, user.id);

    const totalQuantity = createOrderDto.orderProducts.reduce(
      (sum, p) => sum + p.order_quantity,
      0,
    );

    // Server-side fee computation — never trust a fee value from the
    // client, it only ever sends which method it picked.
    const { method: deliveryMethod, fee: deliveryFee } =
      await this.deliveryMethodsService.calculateFee(
        createOrderDto.deliveryMethodId,
        totalQuantity,
      );

    this.assertDeliveryDateInWindow(createOrderDto.requestedDeliveryDate);

    const order = new OrderEntity();
    order.user = user;
    order.shippingAddress = shippingEntity;
    order.shippedAt = null;
    order.status = OrderStatus.PROCESSING;
    order.deliveryMethod = deliveryMethod;
    order.deliveryFee = String(deliveryFee);
    order.requestedDeliveryDate = createOrderDto.requestedDeliveryDate;
    order.paymentMethod = createOrderDto.paymentMethod;
    order.total_price = totalOrderPrice + deliveryFee; // ADD THIS — the grand total, since that's what actually gets charged

    order.products = createOrderDto.orderProducts.map((productDto) => {
      const orderProduct = new OrderProductsEntity();
      orderProduct.product = { id: productDto.productId } as ProductEntity;
      orderProduct.order_quantity = productDto.order_quantity;
      return orderProduct;
    });

    try {
      await this.entityManager.transaction(async (transactionalEntityManager) => {
        await transactionalEntityManager.save(ShippingEntity, shippingEntity);
        await transactionalEntityManager.save(OrderEntity, order);
      });
    } catch (error) {
      const err = normalizeError(error);
      this.auditService.failedOrder(user.id, order.id, err.message, err.stack);
      throw new InternalServerErrorException("Failed to create order.");
    }

    this.auditService.logOrderPlacement(user.id, order.id);
    const savedOrder = await this.findOneOrFail(order.id);
    return {
      order: toOrderResponse(savedOrder),
      totalPrice: totalOrderPrice,
      deliveryFee,
      grandTotal: totalOrderPrice + deliveryFee,
    };
  }

  /** Rejects any date outside "tomorrow .. tomorrow + 13 days" (2-week window), regardless of what the client sends. */
  private assertDeliveryDateInWindow(dateStr: string): void {
    const requested = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const earliest = new Date(today);
    earliest.setDate(earliest.getDate() + 1);
    const latest = new Date(today);
    latest.setDate(latest.getDate() + 14);

    if (requested < earliest || requested > latest) {
      throw new BadRequestException(
        "Requested delivery date is outside the available 2-week window.",
      );
    }
  }

  async findAll(): Promise<OrderEntity[]> {
    return this.orderRepository.find({
      relations: ["shippingAddress", "user", "products"],
    });
  }

  /**
   * Returns the order, or null if it doesn't exist. Use this internally
   * when the caller already handles the not-found case itself (e.g.
   * updateOrderStatus, cancelOrder below).
   */
  async findOne(id: number): Promise<OrderEntity | null> {
    return this.orderRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.shippingAddress", "shippingAddress")
      .leftJoinAndSelect("order.user", "user")
      .addSelect(["user.username", "user.email"])
      .leftJoin("order.updatedBy", "updatedBy")
      .addSelect(["updatedBy.id", "updatedBy.name", "updatedBy.username"])
      .leftJoinAndSelect("order.products", "products")
      .leftJoin("products.product", "product")
      .addSelect(["product.id", "product.title", "product.price"])
      .where("order.id = :id", { id })
      .getOne();
  }

  /**
   * Same as findOne, but throws a 404 when the order doesn't exist.
   * Use this from controllers (e.g. GET /orders/:id) — findOne() on its
   * own would let a missing order fall through as a 200 response with
   * a null body instead of a proper 404.
   */
  async findOneOrFail(id: number): Promise<OrderEntity> {
    const order = await this.findOne(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found.`);
    }
    return order;
  }

  /** Order + the actions still possible on it (drives the admin buttons, so rules live in one place). */
  async getOrderDetail(id: number): Promise<OrderDetailResponseDto> {
    const order = await this.findOneOrFail(id);
    return { ...toOrderResponse(order), allowedActions: getAllowedActions(order.status) };
  }

  async updateOrderStatus(id: number, updateOrderDto: UpdateOrderStatus, user: UserEntity): Promise<OrderDetailResponseDto> {
    const action = ACTION_FOR_STATUS[updateOrderDto.status];
    if (!action) throw new BadRequestException("Status must be shipped or delivered.");

    return this.transition(id, action, user);
  }

  async cancelOrder(id: number, user: UserEntity): Promise<OrderDetailResponseDto> {
    return this.transition(id, OrderAction.CANCEL, user);
  }

  /**
   * Applies one lifecycle action atomically:
   *  - the order row is locked, so two admins clicking at once are serialised and the second gets a 409
   *  - the status check happens on the locked, current row (not on stale data read earlier)
   *  - status, timestamps and stock either all commit or all roll back
   */
  private async transition(id: number, action: OrderAction, user: UserEntity): Promise<OrderDetailResponseDto> {
    await this.entityManager.transaction(async (manager) => {
      const order = await manager.findOne(OrderEntity, { where: { id }, lock: { mode: "pessimistic_write" } });
      if (!order) throw new NotFoundException(`Order with ID ${id} not found.`);

      // Cancelling twice is harmless: keep the call idempotent instead of failing a retry
      if (action === OrderAction.CANCEL && order.status === OrderStatus.CANCELLED) return;

      assertCanTransition(order.status, action);

      const now = new Date();
      order.status = ORDER_TRANSITIONS[action].to;
      order.updatedBy = user;
      if (action === OrderAction.SHIP) order.shippedAt = now;
      if (action === OrderAction.DELIVER) {
        order.deliveredAt = now; // orderAt is no longer overwritten: it stays the real order date
        await this.orderStockService.deductForDelivery(manager, order.id);
      }

      await manager.save(OrderEntity, order);
    });

    return this.getOrderDetail(id);
  }

  private async calculateTotalPrice(orderProducts: OrderProductDto[]): Promise<number> {
    let total = 0;

    for (const productDto of orderProducts) {
      // Fixed: findOne() rejects with NotFoundException when the product
      // doesn't exist, so this loop already surfaces a proper 404 as
      // long as the caller awaits calculateTotalPrice() (see createOrder
      // above) — no extra null check needed here.
      const product = await this.productServices.findOne(productDto.productId);
      total += productDto.order_quantity * product.price;
    }

    return total;
  }

  private async createShippingEntity(shippingAddress: CreateShippingDto): Promise<ShippingEntity> {
    const shippingEntity = new ShippingEntity();
    shippingEntity.phone = shippingAddress.phone;
    shippingEntity.name = shippingAddress.name;
    shippingEntity.address = shippingAddress.address;
    shippingEntity.city = shippingAddress.city;
    shippingEntity.postalCode = shippingAddress.postalCode; // new
    return shippingEntity;
  }
  private async resolveShippingEntity(
    dto: CreateOrderDto,
    userId: number,
  ): Promise<ShippingEntity> {
    if (dto.addressId) {
      const saved = await this.addressRepository.findOne({
        where: { id: dto.addressId, user: { id: userId } },
      });
      if (!saved) throw new NotFoundException("Address not found.");

      const shipping = new ShippingEntity();
      shipping.phone = saved.phone;
      shipping.name = saved.name;
      shipping.address = saved.addressLine;
      shipping.city = saved.city;
      shipping.postalCode = saved.postalCode;
      shipping.sourceAddress = saved;
      return shipping;
    }

    if (dto.shippingAddress) {
      const shippingEntity = new ShippingEntity();
      shippingEntity.phone = dto.shippingAddress.phone;
      shippingEntity.name = dto.shippingAddress.name;
      shippingEntity.address = dto.shippingAddress.address;
      shippingEntity.city = dto.shippingAddress.city;
      shippingEntity.postalCode = dto.shippingAddress.postalCode;
      return shippingEntity;
    }

    throw new BadRequestException("Either addressId or shippingAddress is required.");
  }

  async getOrderSummaryForUser(orderId: number, userId: number): Promise<OrderSummaryResponseDto> {
    const order = await this.findOne(orderId);
    if (!order || order.user.id !== userId) {
      // 404, not 403 — don't confirm another user's order id exists.
      throw new NotFoundException(`Order ${orderId} not found.`);
    }

    const subtotal = order.products.reduce(
      (sum, p) => sum + Number(p.product.price) * p.order_quantity,
      0,
    );

    return {
      id: order.id,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paidAt: order.paidAt ?? null,
      orderAt: order.orderAt,
      products: order.products.map((p) => ({
        title: p.product.title,
        quantity: p.order_quantity,
        price: Number(p.product.price),
      })),
      subtotal,
      deliveryFee: Number(order.deliveryFee),
      total: Number(order.total_price),
    };
  }
}
