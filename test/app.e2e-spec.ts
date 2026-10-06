import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { MongoProvider } from '../src/common/mongo.provider';
import { AppModule } from '../src/app.module';

import { FakeCollection, fakeMongoProvider } from './support/fake-collection';

describe('Wealth API (e2e, in-memory collection)', () => {
  let app: INestApplication;
  let events: FakeCollection;

  const bank = {
    userId: 'user-1',
    bankId: 'BANK',
    txnId: 'T1',
    date: '2025-01-01T10:00:00Z',
    type: 'credit',
    amount: 100,
    currency: 'EUR',
    account: 'ACC-1',
    description: 'salary',
  };

  beforeEach(async () => {
    events = new FakeCollection();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MongoProvider)
      .useValue(fakeMongoProvider(events))
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api answers', async () => {
    const response = await request(app.getHttpServer()).get('/api').expect(200);
    expect(response.body.message).toContain('Wealth Tracker API');
  });

  it('POST /api/webhooks/bank: success, then duplicate, then adjusted', async () => {
    const post = (body: object) =>
      request(app.getHttpServer()).post('/api/webhooks/bank').send(body);

    expect((await post(bank)).body.status).toBe('success');
    expect((await post(bank)).body.status).toBe('duplicate');
    expect((await post({ ...bank, amount: 150 })).body.status).toBe('adjusted');
    expect((await post({ ...bank, amount: 150 })).body.status).toBe(
      'duplicate',
    );
  });

  it('rejects a payload with a missing field', async () => {
    const { amount, ...incomplete } = bank;
    await request(app.getHttpServer())
      .post('/api/webhooks/bank')
      .send(incomplete)
      .expect(400);
  });

  it('GET /api/wealth/balance sums the events of a user', async () => {
    await request(app.getHttpServer()).post('/api/webhooks/bank').send(bank);
    await request(app.getHttpServer())
      .post('/api/webhooks/bank')
      .send({ ...bank, txnId: 'T2', type: 'debit', amount: 30 });

    const response = await request(app.getHttpServer())
      .get('/api/wealth/balance?userId=user-1')
      .expect(200);

    expect(response.body.totalBalanceEUR).toBe(70);
  });

  it('GET /api/wealth/timeline rejects a limit of 0', async () => {
    await request(app.getHttpServer())
      .get('/api/wealth/timeline?userId=user-1&limit=0')
      .expect(400);
  });
});
