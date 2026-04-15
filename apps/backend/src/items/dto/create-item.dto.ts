import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateItemDto {
  @ApiProperty({ example: 49.99, minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    example: 'USD',
    maxLength: 3,
    description: 'ISO 4217 currency code',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  currency: string;

  @ApiProperty({ example: 'Travel', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category: string;

  @ApiProperty({ example: 'Acme Corp', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  merchantName: string;

  @ApiProperty({ example: '2024-03-15', description: 'ISO 8601 date string' })
  @IsDateString()
  transactionDate: string;
}
