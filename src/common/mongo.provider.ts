import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
  Logger,
} from '@nestjs/common';
import { MongoClient, type Db } from 'mongodb';

@Injectable()
export class MongoProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoProvider.name);
  private client: MongoClient;
  private db: Db;

  constructor() {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'wealth_tracker';

    this.logger.log(`Connecting to MongoDB: ${mongoUrl}/${dbName}`);

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
    } catch (error) {
      this.logger.error('MongoDB connection failed', error);
      throw error;
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
