import { Module } from '@nestjs/common';
import { WealthController } from './wealth.controller';
import { WealthService } from './wealth.service';
import { MongoProvider } from '../common/mongo.provider';

@Module({
  controllers: [WealthController],
  providers: [WealthService, MongoProvider],
})
export class WealthModule {}
