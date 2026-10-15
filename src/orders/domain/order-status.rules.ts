import { ConflictException } from '@nestjs/common';

import { OrderStatus } from '../../utils/common/order.enum';

/** What an admin can DO to an order. The resulting status is derived from the action, never sent by the client. */
export enum OrderAction {
  SHIP = 'ship',
  DELIVER = 'deliver',
  CANCEL = 'cancel',
}

interface Transition {
  /** Statuses the action may start from */
  from: readonly string[];
  /** Status the order ends up in */
  to: OrderStatus;
}

/**
 * The single source of truth for the order lifecycle:
 *
 *   processing --ship--> shipped --deliver--> delivered
 *        \--cancel--> cancelled
 *
 * delivered and cancelled are final. Cancelling is only possible before shipping.
 */
export const ORDER_TRANSITIONS: Record<OrderAction, Transition> = {
  [OrderAction.SHIP]: { from: [OrderStatus.PROCESSING], to: OrderStatus.SHIPPED },
  [OrderAction.DELIVER]: { from: [OrderStatus.SHIPPED], to: OrderStatus.DELIVERED },
  [OrderAction.CANCEL]: { from: [OrderStatus.PROCESSING], to: OrderStatus.CANCELLED },
};

/** PUT /orders/:id sends a target status; this maps it to the action it means. */
export const ACTION_FOR_STATUS: Partial<Record<string, OrderAction>> = {
  [OrderStatus.SHIPPED]: OrderAction.SHIP,
  [OrderStatus.DELIVERED]: OrderAction.DELIVER,
};

export const getAllowedActions = (status: string): OrderAction[] =>
  Object.values(OrderAction).filter((action) => ORDER_TRANSITIONS[action].from.includes(status));

/** Throws 409 when `action` is not valid for an order currently in `status`. */
export function assertCanTransition(status: string, action: OrderAction): void {
  if (ORDER_TRANSITIONS[action].from.includes(status)) return;

  const allowed = getAllowedActions(status);
  throw new ConflictException(
    `Cannot ${action} an order that is ${status}. ` +
      (allowed.length > 0 ? `Allowed actions: ${allowed.join(', ')}.` : 'No further actions are possible.'),
  );
}
