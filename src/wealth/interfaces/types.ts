import { NormalizedEvent } from '../dto/normalized-event.dto';

export interface StorageResult {
  readonly stored: boolean;
  readonly duplicate: boolean;
  readonly adjustmentCreated?: boolean;
}

export interface NormalizedEventDocument extends Omit<
  NormalizedEvent,
  'timestamp' | 'createdAt'
> {
  readonly timestamp: string;
  readonly createdAt: string;
}
