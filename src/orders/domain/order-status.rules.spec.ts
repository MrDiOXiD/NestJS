import { ConflictException } from '@nestjs/common';

import { OrderStatus } from '../../utils/common/order.enum';
import { ACTION_FOR_STATUS, OrderAction, assertCanTransition, getAllowedActions } from './order-status.rules';

describe('order status rules', () => {
  it.each([
    [OrderStatus.PROCESSING, [OrderAction.SHIP, OrderAction.CANCEL]],
    [OrderStatus.SHIPPED, [OrderAction.DELIVER]],
    [OrderStatus.DELIVERED, []],
    [OrderStatus.CANCELLED, []],
  ])('allowed actions for %s', (status, expected) => {
    expect(getAllowedActions(status).sort()).toEqual([...expected].sort());
  });

  it('lets a processing order be shipped or cancelled', () => {
    expect(() => assertCanTransition(OrderStatus.PROCESSING, OrderAction.SHIP)).not.toThrow();
    expect(() => assertCanTransition(OrderStatus.PROCESSING, OrderAction.CANCEL)).not.toThrow();
  });

  it('rejects cancelling a shipped order with 409', () => {
    expect(() => assertCanTransition(OrderStatus.SHIPPED, OrderAction.CANCEL)).toThrow(ConflictException);
  });

  it('rejects delivering an order that was never shipped', () => {
    expect(() => assertCanTransition(OrderStatus.PROCESSING, OrderAction.DELIVER)).toThrow(ConflictException);
  });

  it('treats delivered and cancelled as final', () => {
    for (const status of [OrderStatus.DELIVERED, OrderStatus.CANCELLED]) {
      for (const action of Object.values(OrderAction)) {
        expect(() => assertCanTransition(status, action)).toThrow(ConflictException);
      }
    }
  });

  it('maps PUT target statuses to actions', () => {
    expect(ACTION_FOR_STATUS[OrderStatus.SHIPPED]).toBe(OrderAction.SHIP);
    expect(ACTION_FOR_STATUS[OrderStatus.DELIVERED]).toBe(OrderAction.DELIVER);
    expect(ACTION_FOR_STATUS[OrderStatus.CANCELLED]).toBeUndefined();
  });
});
