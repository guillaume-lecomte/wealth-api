import { IsInt, IsNumber, IsString } from 'class-validator';

export class CryptoEventDto {
  @IsString()
  userId: string;

  @IsString()
  platform: string;

  @IsString()
  id: string;

  @IsInt()
  time: number; // ms epoch

  @IsString()
  type: string;

  @IsString()
  asset: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  fiatValue: number;

  @IsString()
  currency: string;

  @IsString()
  walletId: string;
}
