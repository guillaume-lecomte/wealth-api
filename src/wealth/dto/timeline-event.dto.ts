export interface TimelineEventDto {
  transactionId: string;
  timestamp: string;
  provider: string;
  providerId: string;
  accountId: string;
  transactionType: string;
  amount: number;
  currency: string;
  description: string;
}
