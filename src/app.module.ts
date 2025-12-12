import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WealthModule } from './wealth/wealth.module';
import { MongoProvider } from './common/mongo.provider';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    WealthModule,
  ],
  providers: [MongoProvider],
  exports: [MongoProvider],
})
export class AppModule {}
