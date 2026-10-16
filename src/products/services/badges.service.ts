import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { BadgeEntity } from '../entities/badge.entity';
import { CreateBadgeDto } from '../dto/create-badge.dto';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class BadgesService {
  constructor(
    @InjectRepository(BadgeEntity)
    private readonly badgeRepository: Repository<BadgeEntity>,
  ) {}

  async create(dto: CreateBadgeDto): Promise<BadgeEntity> {
    if (await this.badgeRepository.exist({ where: { key: dto.key } })) {
      throw this.duplicateKey(dto.key);
    }

    try {
      return await this.badgeRepository.save(this.badgeRepository.create(dto));
    } catch (error) {
      // Two concurrent requests can both pass the check above — the DB unique index is the real guard.
      if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) throw this.duplicateKey(dto.key);
      throw error;
    }
  }

  findAll(): Promise<BadgeEntity[]> {
    return this.badgeRepository.find({ where: { isActive: true }, order: { id: 'ASC' } });
  }

  /** Throws 400 listing every id that does not exist or is inactive. */
  async assertAllActive(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.badgeRepository.find({ select: { id: true }, where: { id: In(ids), isActive: true } });
    const foundIds = new Set(found.map((badge) => badge.id));
    const invalid = ids.filter((id) => !foundIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(`Unknown or inactive badge id(s): ${invalid.join(', ')}`);
    }
  }

  private duplicateKey(key: string): ConflictException {
    return new ConflictException(`Badge with key "${key}" already exists`);
  }
}
