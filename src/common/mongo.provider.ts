import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
  Logger,
} from '@nestjs/common';
import { MongoClient, type Db } from 'mongodb';

import { COLLECTIONS } from '../wealth/constants/collections.constant';

@Injectable()
export class MongoProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoProvider.name);
  private client: MongoClient;
  private db: Db;

  constructor() {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'wealth_tracker';

    // Only the host is logged: the connection string can hold credentials.
    this.logger.log(
      `Connecting to MongoDB at ${this.hostOf(mongoUrl)}/${dbName}`,
    );

    this.client = new MongoClient(mongoUrl, {
      maxPoolSize: 10,
      minPoolSize: 2,
      retryWrites: true,
      retryReads: true,
    });

    this.db = this.client.db(dbName);
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      await this.db.admin().ping();
      this.logger.log('MongoDB connected successfully');
      await this.ensureIndexes();
    } catch (error) {
      this.logger.error('MongoDB connection failed', error);
      throw error;
    }
  }

  /**
   * Idempotency relies on this index: two deliveries of the same event cannot
   * both be stored, whatever the timing.
   */
  private async ensureIndexes(): Promise<void> {
    await this.db
      .collection(COLLECTIONS.NORMALIZED_EVENTS)
      .createIndex(
        { userId: 1, provider: 1, transactionId: 1 },
        { unique: true, name: 'uniq_user_provider_transaction' },
      );
  }

  private hostOf(mongoUrl: string): string {
    try {
      return new URL(mongoUrl).host;
    } catch {
      return '(unparseable MONGO_URL)';
    }
  }

  getDb(): Db {
    return this.db;
  }

  async onModuleDestroy() {
    try {
      await this.client.close();
      this.logger.log('MongoDB connection closed');
    } catch (error) {
      this.logger.error('Error closing MongoDB connection', error);
    }
  }
}
