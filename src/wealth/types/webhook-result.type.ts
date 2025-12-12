import { WebhookStatus } from '../enums/webhook-status.enum';

export type WebhookResult =
  | { status: WebhookStatus.SUCCESS; message: string; transactionId: string }
  | { status: WebhookStatus.DUPLICATE; message: string; transactionId: string }
  | { status: WebhookStatus.ADJUSTED; message: string; transactionId: string };
