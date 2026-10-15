import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { OrderProductsEntity } from '../entities/order-product.entity';
import { ProductEntity } from '@/products/entities/product.entity';

/**
 * Stock side of the order lifecycle. Runs on the caller's EntityManager so the stock change
 * and the order status change commit (or roll back) together.
 *
 * Policy: stock is deducted when an order is DELIVERED. Cancelling is only allowed before shipping,
 * when nothing has been deducted yet, so a cancel never touches stock.
 */
@Injectable()
export class OrderStockService {
  async deductForDelivery(manager: EntityManager, orderId: number): Promise<void> {
    const lines = await manager.find(OrderProductsEntity, {
      where: { order: { id: orderId } },
      relations: { product: true },
    });

    // The same product can appear on several lines: add them up first
    const quantityByProduct = new Map<number, number>();
    for (const line of lines) {
      if (!line.product) continue; // product was deleted, nothing to deduct
      const quantity = Number(line.order_quantity);
      quantityByProduct.set(line.product.id, (quantityByProduct.get(line.product.id) ?? 0) + quantity);
    }

    // Lock rows in ascending id order: two concurrent deliveries can then never deadlock each other
    for (const productId of [...quantityByProduct.keys()].sort((a, b) => a - b)) {
      const product = await manager.findOne(ProductEntity, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException(`Product ${productId} not found.`);

      const needed = quantityByProduct.get(productId) ?? 0;
      const available = Number(product.stock);
      if (available < needed) {
        throw new ConflictException(
          `Insufficient stock for "${product.title}": ${available} available, ${needed} needed.`,
        );
      }

      await manager.update(ProductEntity, { id: productId }, { stock: available - needed });
    }
  }
}
