import { BadRequestException } from '@nestjs/common';

import {
  FakeCollection,
  fakeMongoProvider,
} from '../../test/support/fake-collection';

import { TransactionType } from './enums/transaction-type.enum';
import { WebhookStatus } from './enums/webhook-status.enum';
import { WealthService } from './wealth.service';

const bankEvent = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  bankId: 'BANK',
  txnId: 'T1',
  date: '2025-01-01T10:00:00Z',
  type: 'credit',
  amount: 100,
  currency: 'EUR',
  account: 'ACC-1',
  description: 'salary',
  ...overrides,
});

const insuranceEvent = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  insurer: 'INS',
  transactionId: 'I1',
  timestamp: 1735905000000,
  movementType: 'premium',
  amount: 100,
  currency: 'EUR',
  policyNumber: 'POL-1',
  ...overrides,
});

describe('WealthService', () => {
  let events: FakeCollection;
  let service: WealthService;

  beforeEach(() => {
    events = new FakeCollection();
    service = new WealthService(fakeMongoProvider(events) as never);
  });

  describe('idempotency', () => {
    it('stores a new event', async () => {
      const result = await service.handleBankEvent(bankEvent() as never);

      expect(result.status).toBe(WebhookStatus.SUCCESS);
      expect(events.docs).toHaveLength(1);
    });

    it('recognises a redelivery with the same effect as a duplicate', async () => {
      await service.handleBankEvent(bankEvent() as never);
      const result = await service.handleBankEvent(bankEvent() as never);

      expect(result.status).toBe(WebhookStatus.DUPLICATE);
      expect(events.docs).toHaveLength(1);
    });

    it('stores one event when the same event arrives twice at the same time', async () => {
      const results = await Promise.all([
        service.handleBankEvent(bankEvent() as never),
        service.handleBankEvent(bankEvent() as never),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([
        WebhookStatus.DUPLICATE,
        WebhookStatus.SUCCESS,
      ]);
      expect(events.docs).toHaveLength(1);
    });
  });

  describe('contradictory events', () => {
    it('keeps the original and adds an adjustment for the difference', async () => {
      await service.handleBankEvent(bankEvent({ amount: 100 }) as never);
      const result = await service.handleBankEvent(
        bankEvent({ amount: 150 }) as never,
      );

      expect(result.status).toBe(WebhookStatus.ADJUSTED);
      expect(events.docs).toHaveLength(2);
      expect(events.docs[0].amount).toBe(100);
      expect(events.docs[1]).toMatchObject({
        origin: 'adjustment',
        amount: 50,
        transactionId: 'BANK-T1-adjustment-1',
      });
      expect((await service.getGlobalBalance('user-1')).totalBalanceEUR).toBe(
        150,
      );
    });

    it('does not add another adjustment when the same correction is redelivered', async () => {
      await service.handleBankEvent(bankEvent({ amount: 100 }) as never);
      await service.handleBankEvent(bankEvent({ amount: 150 }) as never);
      const replay = await service.handleBankEvent(
        bankEvent({ amount: 150 }) as never,
      );

      expect(replay.status).toBe(WebhookStatus.DUPLICATE);
      expect(events.docs).toHaveLength(2);
      expect((await service.getGlobalBalance('user-1')).totalBalanceEUR).toBe(
        150,
      );
    });

    it('adds one adjustment when the same correction arrives twice at the same time', async () => {
      await service.handleBankEvent(bankEvent({ amount: 100 }) as never);
      await Promise.all([
        service.handleBankEvent(bankEvent({ amount: 150 }) as never),
        service.handleBankEvent(bankEvent({ amount: 150 }) as never),
      ]);

      expect(events.docs.filter((d) => d.origin === 'adjustment')).toHaveLength(
        1,
      );
      expect((await service.getGlobalBalance('user-1')).totalBalanceEUR).toBe(
        150,
      );
    });

    it('chains successive corrections', async () => {
      await service.handleBankEvent(bankEvent({ amount: 100 }) as never);
      await service.handleBankEvent(bankEvent({ amount: 150 }) as never);
      await service.handleBankEvent(bankEvent({ amount: 120 }) as never);

      const adjustments = events.docs.filter((d) => d.origin === 'adjustment');
      expect(adjustments.map((a) => a.amount)).toEqual([50, -30]);
      expect(adjustments.map((a) => a.transactionId)).toEqual([
        'BANK-T1-adjustment-1',
        'BANK-T1-adjustment-2',
      ]);
      expect((await service.getGlobalBalance('user-1')).totalBalanceEUR).toBe(
        120,
      );
    });
  });

  describe('dates', () => {
    it.each([['not-a-date'], ['']])(
      'accepts the unparseable date %p and falls back to the current date',
      async (date) => {
        const before = Date.now();
        const result = await service.handleBankEvent(
          bankEvent({ date }) as never,
        );

        expect(result.status).toBe(WebhookStatus.SUCCESS);
        expect(
          new Date(events.docs[0].timestamp).getTime(),
        ).toBeGreaterThanOrEqual(before);
      },
    );

    it('reads day-first dates and Unix timestamps in seconds or milliseconds', async () => {
      await service.handleBankEvent(
        bankEvent({ txnId: 'D1', date: '15/01/2024' }) as never,
      );
      await service.handleInsuranceEvent(
        insuranceEvent({ transactionId: 'S', timestamp: 1735905000 }) as never,
      );
      await service.handleInsuranceEvent(
        insuranceEvent({
          transactionId: 'M',
          timestamp: 1735905000000,
        }) as never,
      );

      const byId = Object.fromEntries(
        events.docs.map((d) => [d.transactionId, d.timestamp]),
      );
      expect(byId['BANK-D1']).toBe('2024-01-15T00:00:00.000Z');
      expect(byId['INS-S']).toBe(byId['INS-M']);
    });
  });

  describe('insurance movements', () => {
    it('records a premium as an outflow and a payout as an inflow', async () => {
      await service.handleInsuranceEvent(insuranceEvent() as never);
      await service.handleInsuranceEvent(
        insuranceEvent({
          transactionId: 'I2',
          movementType: 'payout',
        }) as never,
      );

      const [premium, payout] = events.docs;
      expect(premium).toMatchObject({
        amount: -100,
        transactionType: TransactionType.PREMIUM,
      });
      expect(payout).toMatchObject({
        amount: 100,
        transactionType: TransactionType.PAYOUT,
      });
    });
  });

  describe('reads', () => {
    it('sums per account and counts transactions', async () => {
      await service.handleBankEvent(
        bankEvent({ txnId: 'A', amount: 100 }) as never,
      );
      await service.handleBankEvent(
        bankEvent({ txnId: 'B', type: 'debit', amount: 30 }) as never,
      );

      const balance = await service.getGlobalBalance('user-1');
      expect(balance).toMatchObject({
        totalBalanceEUR: 70,
        accountCount: 1,
        totalTransactions: 2,
      });
    });

    it('returns an empty balance for an unknown user', async () => {
      expect(await service.getGlobalBalance('nobody')).toEqual({
        totalBalanceEUR: 0,
        accountCount: 0,
        totalTransactions: 0,
        accounts: [],
      });
    });

    it('rejects a timeline limit outside 1 to 1000', async () => {
      await expect(service.getTimeline('user-1', 0)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getTimeline('user-1', 1001)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lists the timeline newest business date first', async () => {
      await service.handleBankEvent(
        bankEvent({ txnId: 'OLD', date: '2025-01-01T00:00:00Z' }) as never,
      );
      await service.handleBankEvent(
        bankEvent({ txnId: 'NEW', date: '2025-03-01T00:00:00Z' }) as never,
      );

      const timeline = await service.getTimeline('user-1', 10);
      expect(timeline.map((e) => e.transactionId)).toEqual([
        'BANK-NEW',
        'BANK-OLD',
      ]);
    });
  });
});
