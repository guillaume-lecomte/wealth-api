import { IsInt, IsNumber, IsString } from 'class-validator';

export class InsuranceEventDto {
  @IsString()
  userId: string;

  @IsString()
  insurer: string;

  @IsString()
  transactionId: string;

  @IsInt()
  timestamp: number; // ms epoch

  @IsString()
  movementType: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  policyNumber: string;
}
