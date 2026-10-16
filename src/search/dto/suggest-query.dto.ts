import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { trimString } from '../utils/query-transforms';

export class SuggestQueryDto {
  @ApiProperty({ example: 'لام', maxLength: 60, description: 'What the user has typed so far (min 2 characters to get results).' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  q!: string;

  @ApiPropertyOptional({ type: Number, default: 8, minimum: 1, maximum: 20, description: 'Max product suggestions' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 8;
}
