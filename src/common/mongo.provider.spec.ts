import { Logger } from '@nestjs/common';

const createIndex = jest.fn().mockResolvedValue('index');
const collection = jest.fn().mockReturnValue({ createIndex });
const connect = jest.fn().mockResolvedValue(undefined);

jest.mock('mongodb', () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect,
    close: jest.fn(),
    db: () => ({
      admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }),
      collection,
    }),
  })),
}));

import { MongoProvider } from './mongo.provider';

describe('MongoProvider', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    jest.clearAllMocks();
  });

  it('creates the unique index that idempotency relies on', async () => {
    const provider = new MongoProvider();
    await provider.onModuleInit();

    expect(collection).toHaveBeenCalledWith('normalized_events');
    expect(createIndex).toHaveBeenCalledWith(
      { userId: 1, provider: 1, transactionId: 1 },
      expect.objectContaining({ unique: true }),
    );
  });

  it('does not write the credentials of the connection string to the log', () => {
    process.env.MONGO_URL = 'mongodb://admin:s3cret@db.example:27017';
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    new MongoProvider();

    const logged = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('db.example:27017');
    expect(logged).not.toContain('s3cret');
    expect(logged).not.toContain('admin');
  });
});
