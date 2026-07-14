import { IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderSource } from '../order.entity';

class OrderItemDto {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @IsString() productName: string;
  @ApiProperty() @IsString() sku: string;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(1) quantity: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
}

export class CreateOrderDto {
  @ApiProperty() @IsString() orderNumber: string;
  @ApiProperty() @IsString() customerName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerEmail?: string;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) totalAmount: number;
  @ApiPropertyOptional({ enum: OrderSource }) @IsOptional() @IsEnum(OrderSource) source?: OrderSource;
  @ApiPropertyOptional() @IsOptional() @IsString() shippingAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
  @ApiProperty({ type: [OrderItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items: OrderItemDto[];
}
