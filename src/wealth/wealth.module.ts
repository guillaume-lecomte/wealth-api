import { Module } from '@nestjs/common';

import { MongoProvider } from '../common/mongo.provider';

import { WealthController } from './wealth.controller';
import { WealthService } from './wealth.service';

@Module({
  controllers: [WealthController],
  providers: [WealthService, MongoProvider],
})
export class WealthModule {}
