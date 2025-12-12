import { TransactionType } from '../enums/transaction-type.enum';
import { Provider } from '../enums/provider.enum';
import { EventStatus } from '../enums/event-status.enum';
import { EventOrigin } from '../enums/event-origin.enum';

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
