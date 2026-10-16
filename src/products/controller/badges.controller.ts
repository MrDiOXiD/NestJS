import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { BadgesService } from '../services/badges.service';
import { CreateBadgeDto } from '../dto/create-badge.dto';
import { BadgeEntity } from '../entities/badge.entity';
import { AuthenticationGuard } from '../../utils/guard/auth.guard';
import { AuthorizedGuard } from '../../utils/guard/authorized-role.guard';
import { Roles } from '../../utils/common/Roles.enum';

@ApiTags('badges')
@ApiBearerAuth()
@Controller('badges')
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get()
  @ApiOperation({ summary: 'List active badges', description: 'Use the returned ids when attaching badges to a product.' })
  @ApiOkResponse({ type: [BadgeEntity] })
  findAll(): Promise<BadgeEntity[]> {
    return this.badgesService.findAll();
  }

  @UseGuards(AuthenticationGuard, AuthorizedGuard([Roles.ADMIN]))
  @Post()
  @ApiOperation({
    summary: 'Create a badge',
    description: 'Badges live in their own table and can later be attached (several at once) to any product.',
  })
  @ApiBody({
    type: CreateBadgeDto,
    examples: {
      bestseller: {
        summary: 'Full payload',
        value: { key: 'bestseller', label: 'پرفروش', color: '#F59E0B', textColor: '#FFFFFF', isActive: true },
      },
      hot: {
        summary: 'Hot badge',
        value: { key: 'hot', label: 'داغ', color: '#DC2626', textColor: '#FFFFFF' },
      },
      minimal: {
        summary: 'Minimal (colors fall back to defaults)',
        value: { key: 'new', label: 'جدید' },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Badge created',
    type: BadgeEntity,
    example: {
      id: 1,
      key: 'bestseller',
      label: 'پرفروش',
      color: '#F59E0B',
      textColor: '#FFFFFF',
      isActive: true,
      createdAt: '2026-10-14T12:00:00.000Z',
      updatedAt: '2026-10-14T12:00:00.000Z',
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    example: { statusCode: 400, message: ['color must be a 6-digit hex value like #F59E0B'], error: 'Bad Request' },
  })
  @ApiConflictResponse({
    description: 'Badge key already exists',
    example: { statusCode: 409, message: 'Badge with key "hot" already exists', error: 'Conflict' },
  })
  create(@Body() dto: CreateBadgeDto): Promise<BadgeEntity> {
    return this.badgesService.create(dto);
  }
}
