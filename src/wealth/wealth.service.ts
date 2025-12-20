import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { type Collection, type Db, MongoError, WithId } from 'mongodb';

import { MongoProvider } from '../common/mongo.provider';

import { COLLECTIONS } from './constants/collections.constant';
import { type AccountBalanceDto } from './dto/account-balance.dto';
import { type BankEventDto } from './dto/bank-event.dto';
import { type CryptoEventDto } from './dto/crypto-event.dto';
import { type EventDto } from './dto/event.dto';
import { type GlobalBalanceDto } from './dto/global-balance.dto';
import { type InsuranceEventDto } from './dto/insurance-event.dto';
import { type NormalizedEvent } from './dto/normalized-event.dto';
import { type TimelineEventDto } from './dto/timeline-event.dto';
import { EventOrigin } from './enums/event-origin.enum';
import { EventStatus } from './enums/event-status.enum';
import { Provider } from './enums/provider.enum';
import { TransactionType } from './enums/transaction-type.enum';
import { WebhookStatus } from './enums/webhook-status.enum';
import { parseDate } from './helpers/date.helper';
import {
  type NormalizedEventDocument,
  type StorageResult,
} from './interfaces/types';
import { type WebhookResult } from './types/webhook-result.type';

const DEFAULT_CURRENCY = 'EUR';
const DEFAULT_USER_ID = 'user-001';
const DEFAULT_TIMELINE_LIMIT = 100;
const MAX_TIMELINE_LIMIT = 1000;
const DECIMAL_PRECISION = 100; // Pour arrondir à 2 décimales

@Injectable()
export class WealthService {
  private readonly db: Db;
  private readonly eventsCollection: Collection<NormalizedEventDocument>;
  private readonly logger = new Logger(WealthService.name);

  constructor(private readonly mongoProvider: MongoProvider) {
    this.db = this.mongoProvider.getDb();
    this.eventsCollection = this.db.collection<NormalizedEventDocument>(
      COLLECTIONS.NORMALIZED_EVENTS,
    );
  }

  private buildGroupKey(event: {
    provider: Provider;
    providerId: string;
    accountId: string;
    currency: string;
  }): string {
    return `${event.provider}:${event.providerId}:${event.accountId}:${event.currency}`;
  }

  private toDocument(event: NormalizedEvent): NormalizedEventDocument {
    return {
      ...event,
      timestamp: event.timestamp.toISOString(),
      createdAt: event.createdAt.toISOString(),
    };
  }

  private roundAmount(amount: number): number {
    return Math.round(amount * DECIMAL_PRECISION) / DECIMAL_PRECISION;
  }

  private normalizeBankEvent(event: BankEventDto): NormalizedEvent {
    const isCredit = event.type === 'credit';
    const transactionType = isCredit
      ? TransactionType.CREDIT
      : TransactionType.DEBIT;

    const base: Omit<NormalizedEvent, 'groupKey'> = {
      userId: event.userId,
      provider: Provider.BANK,
      providerId: event.bankId,
      transactionId: `${event.bankId}-${event.txnId}`,
      timestamp: parseDate(event.date),
      transactionType,
      amount: isCredit ? event.amount : -event.amount,
      currency: event.currency || DEFAULT_CURRENCY,
      accountId: event.account || 'unknown-account',
      description: event.description || 'Bank transaction',
      rawData: { ...event },
      createdAt: new Date(),
      status: EventStatus.SETTLED,
      origin: EventOrigin.EXTERNAL,
    };

    return {
      ...base,
      groupKey: this.buildGroupKey(base),
    };
  }

  private normalizeCryptoEvent(event: CryptoEventDto): NormalizedEvent {
    const isDeposit = event.type.toLowerCase().includes('deposit');
    const transactionType = isDeposit
      ? TransactionType.DEPOSIT
      : TransactionType.WITHDRAWAL;

    const base: Omit<NormalizedEvent, 'groupKey'> = {
      userId: event.userId,
      provider: Provider.CRYPTO,
      providerId: event.platform,
      transactionId: `${event.platform}-${event.id}`,
      timestamp: parseDate(event.time),
      transactionType,
      amount: isDeposit ? event.fiatValue : -event.fiatValue,
      currency: event.currency || DEFAULT_CURRENCY,
      accountId: event.walletId || 'unknown-wallet',
      description: `${event.type} - ${event.amount} ${event.asset}`,
      rawData: { ...event },
      createdAt: new Date(),
      status: EventStatus.SETTLED,
      origin: EventOrigin.EXTERNAL,
    };

    return {
      ...base,
      groupKey: this.buildGroupKey(base),
    };
  }

  private normalizeInsuranceEvent(event: InsuranceEventDto): NormalizedEvent {
    const base: Omit<NormalizedEvent, 'groupKey'> = {
      userId: event.userId,
      provider: Provider.INSURANCE,
      providerId: event.insurer,
      transactionId: `${event.insurer}-${event.transactionId}`,
      timestamp: parseDate(event.timestamp),
      transactionType: TransactionType.PREMIUM,
      amount: -event.amount,
      currency: event.currency || DEFAULT_CURRENCY,
      accountId: event.policyNumber || 'unknown-policy',
      description: `${event.movementType} payment`,
      rawData: { ...event },
      createdAt: new Date(),
      status: EventStatus.SETTLED,
      origin: EventOrigin.EXTERNAL,
    };

    return {
      ...base,
      groupKey: this.buildGroupKey(base),
    };
  }

  private async findExistingEvent(
    userId: string,
    provider: Provider,
    transactionId: string,
  ): Promise<NormalizedEventDocument | null> {
    try {
      return await this.eventsCollection.findOne(
        { userId, provider, transactionId },
        { projection: { _id: 0 } },
      );
    } catch (error) {
      this.logger.error(
        `Error finding existing event: ${transactionId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Database query failed');
    }
  }

  private createAdjustmentEvent(
    event: NormalizedEvent,
    existing: NormalizedEventDocument,
    diff: number,
  ): NormalizedEvent {
    return {
      userId: event.userId,
      provider: event.provider,
      providerId: event.providerId,
      transactionId: `${event.transactionId}-adjustment-${Date.now()}`,
      timestamp: new Date(),
      transactionType:
        diff >= 0 ? TransactionType.DEPOSIT : TransactionType.WITHDRAWAL,
      amount: diff,
      currency: event.currency,
      accountId: event.accountId,
      description: `Adjustment for inconsistent event ${event.transactionId}`,
      rawData: { newEvent: event, previousEvent: existing },
      createdAt: new Date(),
      status: EventStatus.SETTLED,
      origin: EventOrigin.ADJUSTMENT,
      groupKey: event.groupKey,
    };
  }

  private async storeNormalizedEvent(
    event: NormalizedEvent,
  ): Promise<StorageResult> {
    const existing = await this.findExistingEvent(
      event.userId,
      event.provider,
      event.transactionId,
    );

    // Cas 1 : Pas d'événement existant → insertion
    if (!existing) {
      try {
        await this.eventsCollection.insertOne(this.toDocument(event));
        return { stored: true, duplicate: false };
      } catch (error) {
        if (error instanceof MongoError && error.code === 11000) {
          // Gestion de la concurrence : doublon créé entre-temps
          this.logger.warn(
            `Race condition detected for ${event.transactionId}`,
          );
          return { stored: false, duplicate: true };
        }
        throw error;
      }
    }

    // Cas 2 : Même effet métier → doublon pur (idempotence)
    const sameAmount = existing.amount === event.amount;
    const sameType = existing.transactionType === event.transactionType;

    if (sameAmount && sameType) {
      return { stored: false, duplicate: true };
    }

    // Cas 3 : Contradiction → création d'un événement d'ajustement
    const diff = this.roundAmount(event.amount - existing.amount);

    if (diff !== 0) {
      const adjustment = this.createAdjustmentEvent(event, existing, diff);

      try {
        await this.eventsCollection.insertOne(this.toDocument(adjustment));
        this.logger.warn(
          `Adjustment created for ${event.transactionId}: diff=${diff}`,
        );
        return { stored: false, duplicate: false, adjustmentCreated: true };
      } catch (error) {
        this.logger.error(
          `Failed to create adjustment for ${event.transactionId}`,
          error instanceof Error ? error.stack : String(error),
        );
        throw new InternalServerErrorException('Adjustment creation failed');
      }
    }

    return { stored: false, duplicate: true };
  }

  private async processEvent(
    event: EventDto,
    normalizer: (event: EventDto) => NormalizedEvent,
    eventType: string,
  ): Promise<WebhookResult> {
    try {
      const normalized = normalizer(event);
      const result = await this.storeNormalizedEvent(normalized);

      if (result.duplicate) {
        return {
          status: WebhookStatus.DUPLICATE,
          message: 'Event already processed with same effect',
          transactionId: normalized.transactionId,
        };
      }

      if (result.adjustmentCreated) {
        return {
          status: WebhookStatus.ADJUSTED,
          message: 'Contradictory event reconciled via adjustment',
          transactionId: normalized.transactionId,
        };
      }

      return {
        status: WebhookStatus.SUCCESS,
        message: 'Event processed successfully',
        transactionId: normalized.transactionId,
      };
    } catch (error) {
      this.logger.error(
        `Error processing ${eventType} event`,
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to process ${eventType} event`,
      );
    }
  }

  async handleBankEvent(event: BankEventDto): Promise<WebhookResult> {
    return this.processEvent(
      event,
      (e) => this.normalizeBankEvent(e as BankEventDto),
      'bank',
    );
  }

  async handleCryptoEvent(event: CryptoEventDto): Promise<WebhookResult> {
    return this.processEvent(
      event,
      (e) => this.normalizeCryptoEvent(e as CryptoEventDto),
      'crypto',
    );
  }

  async handleInsuranceEvent(event: InsuranceEventDto): Promise<WebhookResult> {
    return this.processEvent(
      event,
      (e) => this.normalizeInsuranceEvent(e as InsuranceEventDto),
      'insurance',
    );
  }

  async getGlobalBalance(userId = DEFAULT_USER_ID): Promise<GlobalBalanceDto> {
    try {
      const events = await this.eventsCollection
        .find(
          { userId, status: EventStatus.SETTLED },
          { projection: { _id: 0 } },
        )
        .toArray();

      if (events.length === 0) {
        return {
          totalBalanceEUR: 0,
          accountCount: 0,
          totalTransactions: 0,
          accounts: [],
        };
      }

      const accountsMap = new Map<string, AccountBalanceDto>();

      for (const event of events) {
        const { accountId } = event;

        if (!accountsMap.has(accountId)) {
          accountsMap.set(accountId, {
            accountId,
            provider: event.provider,
            providerId: event.providerId,
            balance: 0,
            currency: event.currency,
            transactionCount: 0,
          });
        }

        const account = accountsMap.get(accountId);
        account.balance = this.roundAmount(account.balance + event.amount);
        account.transactionCount += 1;
      }

      const accounts = Array.from(accountsMap.values());
      const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

      return {
        totalBalanceEUR: this.roundAmount(totalBalance),
        accountCount: accounts.length,
        totalTransactions: events.length,
        accounts,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching global balance for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to fetch global balance');
    }
  }

  async getAccountsDetail(
    userId = DEFAULT_USER_ID,
  ): Promise<AccountBalanceDto[]> {
    const balanceData = await this.getGlobalBalance(userId);
    return balanceData.accounts;
  }

  async getTimeline(
    userId = DEFAULT_USER_ID,
    limit = DEFAULT_TIMELINE_LIMIT,
  ): Promise<TimelineEventDto[]> {
    // Validation des paramètres
    if (limit <= 0 || limit > MAX_TIMELINE_LIMIT) {
      throw new BadRequestException(
        `Limit must be between 1 and ${MAX_TIMELINE_LIMIT}`,
      );
    }

    try {
      const events = await this.eventsCollection
        .find(
          { userId, status: EventStatus.SETTLED },
          { projection: { _id: 0 } },
        )
        .sort({ timestamp: -1, createdAt: -1 })
        .limit(limit)
        .toArray();

      return events.map(
        (event): TimelineEventDto => ({
          transactionId: event.transactionId,
          timestamp: event.timestamp,
          provider: event.provider,
          providerId: event.providerId,
          accountId: event.accountId,
          transactionType: event.transactionType,
          amount: event.amount,
          currency: event.currency,
          description: event.description,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Error fetching timeline for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to fetch timeline');
    }
  }
}
