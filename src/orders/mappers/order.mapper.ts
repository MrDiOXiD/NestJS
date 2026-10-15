import { OrderEntity } from '../entities/order.entity';
import { OrderResponseDto } from '../dto/order-response.dto';

/** Entity -> API shape. Picks fields one by one on purpose (whitelist, never spread the entity). */
export function toOrderResponse(order: OrderEntity): OrderResponseDto {
  const { user, shippingAddress, updatedBy } = order;

  return {
    id: order.id,
    orderAt: order.orderAt,
    shippedAt: order.shippedAt ?? null,
    deliveredAt: order.deliveredAt ?? null,
    status: order.status,
    total_price: String(order.total_price),
    deliveryFee: String(order.deliveryFee),
    paidAt: order.paidAt ?? null,
    requestedDeliveryDate: order.requestedDeliveryDate,
    paymentMethod: order.paymentMethod,
    shippingAddress: shippingAddress
      ? {
          id: shippingAddress.id,
          phone: shippingAddress.phone,
          name: shippingAddress.name,
          address: shippingAddress.address,
          postalCode: shippingAddress.postalCode,
          city: shippingAddress.city,
        }
      : null,
    user: user
      ? {
          id: user.id,
          name: user.name,
          familyName: user.familyName,
          username: user.username,
          email: user.email,
          phoneNumber: user.phoneNumber,
        }
      : null,
    products: (order.products ?? []).map((line) => ({
      id: line.id,
      order_quantity: line.order_quantity,
      ...(line.product
        ? { product: { id: line.product.id, title: line.product.title, price: String(line.product.price) } }
        : {}),
    })),
    updatedBy: updatedBy ? { id: updatedBy.id, name: updatedBy.name, username: updatedBy.username } : null,
  };
}
