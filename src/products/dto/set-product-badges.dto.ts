import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsPositive } from 'class-validator';

export class SetProductBadgesDto {
  @ApiProperty({
    type: [Number],
    example: [1, 3],
    description: 'Badge ids (see GET /badges). Max 10, no duplicates. An empty array clears all badges.',
  })
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  badgeIds!: number[];
}
