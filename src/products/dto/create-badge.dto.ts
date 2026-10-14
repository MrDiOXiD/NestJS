import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateBadgeDto {
  @ApiProperty({ example: 'bestseller', description: 'Lowercase slug: letters, digits, "-" or "_"', maxLength: 30 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^[a-z][a-z0-9_-]*$/, { message: 'key must start with a letter and contain only a-z, 0-9, "-" or "_"' })
  key!: string;

  @ApiProperty({ example: 'پرفروش', maxLength: 50 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label!: string;

  @ApiPropertyOptional({ example: '#F59E0B', default: '#2563EB' })
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'color must be a 6-digit hex value like #F59E0B' })
  color?: string;

  @ApiPropertyOptional({ example: '#FFFFFF', default: '#FFFFFF' })
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'textColor must be a 6-digit hex value like #FFFFFF' })
  textColor?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
