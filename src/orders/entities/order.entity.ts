import { UserEntity } from "@/users/entities/user.entity";
import { DeliveryMethodEntity } from "@/delivery/entities/delivery-method.entity";

export type PaymentMethodType = "online" | "cod";

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ShippingEntity } from "./shipping.entity";
import { OrderProductsEntity } from "./order-product.entity";
import { OrderStatus } from "../../utils/common/order.enum";

// Serve the admin list: filter by status + newest first, and the unfiltered newest-first default.
@Index("IDX_order_status_orderAt", ["status", "orderAt"])
@Index("IDX_order_orderAt", ["orderAt"])
@Entity({ name: "order" })
export class OrderEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn()
  orderAt!: Date;

  @Column({ type: "timestamp", nullable: true })
  shippedAt!: Date | null;

  @Column({ type: "timestamp", nullable: true })
  deliveredAt!: Date | null;

  // Carrier tracking code (کد رهگیری), e.g. from Tipax. Set when the order is shipped.
  @Column({ type: "varchar", length: 50, nullable: true })
  trackingCode!: string | null;

  @Column({ type: "enum", enum: OrderStatus, default: OrderStatus.PROCESSING })
  status!: string;

  @Column({ type: "decimal", precision: 10, default: 0, scale: 2 })
  total_price!: number;

  @ManyToOne(() => UserEntity, (user) => user.orderUpdatedBy)
  updatedBy!: UserEntity;

  @OneToOne(() => ShippingEntity, (shipping) => shipping.order, { cascade: true })
  @JoinColumn()
  shippingAddress!: ShippingEntity | null; // null for pickup orders and legacy orders

  @Column({ type: "timestamp", nullable: true })
  paidAt?: Date;

  @OneToMany(() => OrderProductsEntity, (ord) => ord.order, { cascade: true })
  products!: OrderProductsEntity[];

  @Index("IDX_order_userId") // FK: Postgres does not index it automatically
  @ManyToOne(() => UserEntity, (user) => user.orders)
  user!: UserEntity;

  @ManyToOne(() => DeliveryMethodEntity, { nullable: true })
  @JoinColumn()
  deliveryMethod?: DeliveryMethodEntity;

  @Column({ type: "decimal", precision: 12, scale: 0, default: 0 })
  deliveryFee!: string;

  @Column({ type: "date" })
  requestedDeliveryDate!: string; // 'YYYY-MM-DD'

  @Column({ type: "varchar", length: 10, default: "online" })
  paymentMethod!: PaymentMethodType;
}