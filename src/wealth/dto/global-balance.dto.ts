import { type AccountBalanceDto } from './account-balance.dto';

export interface GlobalBalanceDto {
  totalBalanceEUR: number;
  accountCount: number;
  totalTransactions: number;
  accounts: AccountBalanceDto[];
}
