export interface AccountBalanceDto {
  accountId: string;
  provider: string;
  providerId: string;
  balance: number;
  currency: string;
  transactionCount: number;
}
