import { Global, Module } from '@nestjs/common';

import { MongoProvider } from './mongo.provider';

/**
 * One MongoDB client for the whole application.
 */
@Global()
@Module({
  providers: [MongoProvider],
  exports: [MongoProvider],
})
export class MongoModule {}
