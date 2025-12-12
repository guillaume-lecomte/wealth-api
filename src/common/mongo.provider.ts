import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';

@Injectable()
export class MongoProvider implements OnModuleInit, OnModuleDestroy {
  private client: MongoClient;
  private db: Db;

  constructor() {
    const mongoUrl = process.env.MONGO_URL as string;
    const dbName = process.env.DB_NAME as string;

    this.client = new MongoClient(mongoUrl);
    this.db = this.client.db(dbName);
  }

  async onModuleInit() {
    await this.client.connect();
  }

  getDb(): Db {
    return this.db;
  }

  async onModuleDestroy() {
    await this.client.close();
  }
}
