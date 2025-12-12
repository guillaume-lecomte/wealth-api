import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Db } from 'mongodb';
import { MongoProvider } from '../common/mongo.provider';
import { BankEventDto } from './dto/bank-event.dto';
import { CryptoEventDto } from './dto/crypto-event.dto';
import { InsuranceEventDto } from './dto/insurance-event.dto';
import { NormalizedEvent } from './dto/normalized-event.dto';
import { Provider } from './enums/provider.enum';
import { TransactionType } from './enums/transaction-type.enum';
import { EventStatus } from './enums/event-status.enum';
import { EventOrigin } from './enums/event-origin.enum';
import { GlobalBalanceDto } from './dto/global-balance.dto';
import { AccountBalanceDto } from './dto/account-balance.dto';
import { TimelineEventDto } from './dto/timeline-event.dto';
import { WebhookResult } from './types/webhook-result.type';
import { WebhookStatus } from './enums/webhook-status.enum';

@Injectable()
export class WealthService {
  private db: Db;
  private readonly logger = new Logger(WealthService.name);

  constructor(private readonly mongoProvider: MongoProvider) {
    this.db = this.mongoProvider.getDb();
  }

  private buildGroupKey(e: {
    provider: Provider;
    providerId: string;
    accountId: string;
    currency: string;
  }) {
    return `${e.provider}:${e.providerId}:${e.accountId}:${e.currency}`;
  }

  private normalizeBankEvent(event: BankEventDto): NormalizedEvent {
    const isCredit = event.type === 'credit';
    const transactionType = isCredit
      ? TransactionType.CREDIT
      : TransactionType.DEBIT;

    const parsedDate = isNaN(Date.parse(event.date))
      ? new Date()
      : new Date(event.date);

    const base: Omit<NormalizedEvent, 'groupKey'> = {
      userId: event.userId,
      provider: Provider.BANK,
      providerId: event.bankId,
      transactionId: `${event.bankId}-${event.txnId}`,
      timestamp: parsedDate,
      transactionType,
      amount: isCredit ? event.amount : -event.amount,
      currency: event.currency || 'EUR',
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

    const timestamp = new Date(event.time);

    const base: Omit<NormalizedEvent, 'groupKey'> = {
      userId: event.userId,
      provider: Provider.CRYPTO,
      providerId: event.platform,
      transactionId: `${event.platform}-${event.id}`,
      timestamp,
      transactionType,
      amount: isDeposit ? event.fiatValue : -event.fiatValue,
      currency: event.currency || 'EUR',
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
    const timestamp = new Date(event.timestamp);

    const base: Omit<NormalizedEvent, 'groupKey'> = {
      userId: event.userId,
      provider: Provider.INSURANCE,
      providerId: event.insurer,
      transactionId: `${event.insurer}-${event.transactionId}`,
      timestamp,
      transactionType: TransactionType.PREMIUM,
      amount: -event.amount,
      currency: event.currency || 'EUR',
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
  ) {
    return this.db
      .collection('normalized_events')
      .findOne({ userId, provider, transactionId }, { projection: { _id: 0 } });
  }

  private async storeNormalizedEvent(event: NormalizedEvent): Promise<{
    stored: boolean;
    duplicate: boolean;
    adjustmentCreated?: boolean;
  }> {
    const existing = await this.findExistingEvent(
      event.userId,
      event.provider,
      event.transactionId,
    );

    // 1) Pas d’événement existant -> insertion
    if (!existing) {
      const doc = {
        ...event,
        timestamp: event.timestamp.toISOString(),
        createdAt: event.createdAt.toISOString(),
      };
      await this.db.collection('normalized_events').insertOne(doc);
      return { stored: true, duplicate: false };
    }

    // 2) Même effet métier -> doublon pur
    const sameAmount = existing.amount === event.amount;
    const sameType = existing.transactionType === event.transactionType;
    if (sameAmount && sameType) {
      return { stored: false, duplicate: true };
    }

    // 3) Contradiction -> on corrige via un event d’ajustement
    const diff = event.amount - existing.amount;
    if (diff !== 0) {
      const adjustment: NormalizedEvent = {
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

      const docAdj = {
        ...adjustment,
        timestamp: adjustment.timestamp.toISOString(),
        createdAt: adjustment.createdAt.toISOString(),
      };

      await this.db.collection('normalized_events').insertOne(docAdj);
      return { stored: false, duplicate: false, adjustmentCreated: true };
    }

    // Diff nul mais type différent -> pas d’impact sur le solde
    return { stored: false, duplicate: true };
  }

  async handleBankEvent(event: BankEventDto): Promise<WebhookResult> {
    try {
      const normalized = this.normalizeBankEvent(event);
      const res = await this.storeNormalizedEvent(normalized);

      if (res.duplicate) {
        return {
          status: WebhookStatus.DUPLICATE,
          message: 'Event already processed with same effect',
          transactionId: normalized.transactionId,
        };
      }

      if (res.adjustmentCreated) {
        return {
          status: WebhookStatus.ADJUSTED,
          message: 'Contradictory event reconciled via adjustment',
          transactionId: normalized.transactionId,
        };
      }

      return {
        status: WebhookStatus.SUCCESS,
        message: 'Event processed',
        transactionId: normalized.transactionId,
      };
    } catch (error) {
      this.logger.error(
        `Error while handling bank event`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException('Failed to process bank event');
    }
  }

  async handleCryptoEvent(event: CryptoEventDto): Promise<WebhookResult> {
    try {
      const normalized = this.normalizeCryptoEvent(event);
      const res = await this.storeNormalizedEvent(normalized);

      if (res.duplicate) {
        return {
          status: WebhookStatus.DUPLICATE,
          message: 'Event already processed with same effect',
          transactionId: normalized.transactionId,
        };
      }

      if (res.adjustmentCreated) {
        return {
          status: WebhookStatus.ADJUSTED,
          message: 'Contradictory event reconciled via adjustment',
          transactionId: normalized.transactionId,
        };
      }

      return {
        status: WebhookStatus.SUCCESS,
        message: 'Event processed',
        transactionId: normalized.transactionId,
      };
    } catch (error) {
      this.logger.error(
        `Error while handling crypto event`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException('Failed to process crypto event');
    }
  }

  async handleInsuranceEvent(event: InsuranceEventDto): Promise<WebhookResult> {
    try {
      const normalized = this.normalizeInsuranceEvent(event);
      const res = await this.storeNormalizedEvent(normalized);

      if (res.duplicate) {
        return {
          status: WebhookStatus.DUPLICATE,
          message: 'Event already processed with same effect',
          transactionId: normalized.transactionId,
        };
      }

      if (res.adjustmentCreated) {
        return {
          status: WebhookStatus.ADJUSTED,
          message: 'Contradictory event reconciled via adjustment',
          transactionId: normalized.transactionId,
        };
      }

      return {
        status: WebhookStatus.SUCCESS,
        message: 'Event processed',
        transactionId: normalized.transactionId,
      };
    } catch (error) {
      this.logger.error(
        `Error while handling insurance event`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException(
        'Failed to process insurance event',
      );
    }
  }

  async getGlobalBalance(userId = 'user-001'): Promise<GlobalBalanceDto> {
    const events = await this.db
      .collection('normalized_events')
      .find({ userId, status: EventStatus.SETTLED }, { projection: { _id: 0 } })
      .toArray();

    if (!events.length) {
      return {
        totalBalanceEUR: 0,
        accountCount: 0,
        totalTransactions: 0,
        accounts: [],
      };
    }

    const accountsData: Record<string, AccountBalanceDto> = {};

    for (const event of events) {
      const accountId = event.accountId;
      if (!accountsData[accountId]) {
        accountsData[accountId] = {
          accountId,
          provider: event.provider,
          providerId: event.providerId,
          balance: 0,
          currency: event.currency,
          transactionCount: 0,
        };
      }

      accountsData[accountId].balance += event.amount;
      accountsData[accountId].transactionCount += 1;
    }

    const accounts = Object.values(accountsData);
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    return {
      totalBalanceEUR: Math.round(totalBalance * 100) / 100,
      accountCount: accounts.length,
      totalTransactions: events.length,
      accounts,
    };
  }

  async getAccountsDetail(userId = 'user-001'): Promise<AccountBalanceDto[]> {
    const balanceData = await this.getGlobalBalance(userId);
    return balanceData.accounts;
  }

  async getTimeline(
    userId = 'user-001',
    limit = 100,
  ): Promise<TimelineEventDto[]> {
    const events = await this.db
      .collection('normalized_events')
      .find({ userId, status: EventStatus.SETTLED }, { projection: { _id: 0 } })
      .sort({ timestamp: -1, createdAt: -1 })
      .limit(limit)
      .toArray();

    return events.map((event) => ({
      transactionId: event.transactionId,
      timestamp: event.timestamp,
      provider: event.provider,
      providerId: event.providerId,
      accountId: event.accountId,
      transactionType: event.transactionType,
      amount: event.amount,
      currency: event.currency,
      description: event.description,
    }));
  }
}
