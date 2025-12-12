import { IsNumber, IsString } from 'class-validator';

export class BankEventDto {
  @IsString()
  userId: string;

  @IsString()
  bankId: string;

  @IsString()
  txnId: string;

  @IsString()
  date: string; // ISO string, éventuellement invalide

  @IsString()
  type: string; // "credit" / "debit"...

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  account: string;

  @IsString()
  description: string;
}
