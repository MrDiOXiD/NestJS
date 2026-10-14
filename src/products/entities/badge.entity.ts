import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ name: 'badges' })
export class BadgeEntity {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ example: 'bestseller', description: 'Unique machine-readable slug' })
  @Column({ type: 'varchar', length: 30, unique: true })
  key!: string;

  @ApiProperty({ example: 'پرفروش', description: 'Text shown to customers' })
  @Column({ type: 'varchar', length: 50 })
  label!: string;

  @ApiProperty({ example: '#F59E0B', description: 'Background color (hex)' })
  @Column({ type: 'varchar', length: 7, default: '#2563EB' })
  color!: string;

  @ApiProperty({ example: '#FFFFFF', description: 'Text color (hex)' })
  @Column({ type: 'varchar', length: 7, default: '#FFFFFF' })
  textColor!: string;

  @ApiProperty({ example: true, default: true })
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-10-14T12:00:00.000Z' })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({ example: '2026-10-14T12:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt!: Date;
}
