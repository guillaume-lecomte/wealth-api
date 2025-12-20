import { type BankEventDto } from './bank-event.dto';
import { type CryptoEventDto } from './crypto-event.dto';
import { type InsuranceEventDto } from './insurance-event.dto';

export type EventDto = BankEventDto | CryptoEventDto | InsuranceEventDto;
