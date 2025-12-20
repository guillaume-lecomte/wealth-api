import { type EventOrigin } from '../enums/event-origin.enum';
import { type EventStatus } from '../enums/event-status.enum';
import { type Provider } from '../enums/provider.enum';
import { type TransactionType } from '../enums/transaction-type.enum';

export interface NormalizedEvent {
  userId: string;
  provider: Provider;
  providerId: string;
  transactionId: string;
  timestamp: Date;
  transactionType: TransactionType;
  amount: number;
  currency: string;
  accountId: string;
  description: string;
  rawData: Record<string, any>;
  createdAt: Date;
  status: EventStatus;
  origin: EventOrigin;
  groupKey: string;
}
