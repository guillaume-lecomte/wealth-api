import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MongoModule } from './common/mongo.module';
import { WealthModule } from './wealth/wealth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongoModule,
    WealthModule,
  ],
})
export class AppModule {}
