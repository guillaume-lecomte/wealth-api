import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { WealthService } from './wealth.service';
import { BankEventDto } from './dto/bank-event.dto';
import { CryptoEventDto } from './dto/crypto-event.dto';
import { InsuranceEventDto } from './dto/insurance-event.dto';
import { GlobalBalanceDto } from './dto/global-balance.dto';
import { AccountBalanceDto } from './dto/account-balance.dto';
import { TimelineEventDto } from './dto/timeline-event.dto';

@Controller('api')
export class WealthController {
  constructor(private readonly wealthService: WealthService) {}

  @Get()
  root() {
    return {
      message:
        'Wealth Tracker API - Prototype de gestion du patrimoine financier',
    };
  }

  // Webhooks

  @Post('webhooks/bank')
  async receiveBankEvent(
    @Body() event: BankEventDto,
  ): Promise<{ status: string; message: string; transactionId: string }> {
    return this.wealthService.handleBankEvent(event);
  }

  @Post('webhooks/crypto')
  async receiveCryptoEvent(
    @Body() event: CryptoEventDto,
  ): Promise<{ status: string; message: string; transactionId: string }> {
    return this.wealthService.handleCryptoEvent(event);
  }

  @Post('webhooks/insurance')
  async receiveInsuranceEvent(
    @Body() event: InsuranceEventDto,
  ): Promise<{ status: string; message: string; transactionId: string }> {
    return this.wealthService.handleInsuranceEvent(event);
  }

  // Lecture du patrimoine

  @Get('wealth/balance')
  async getGlobalBalance(
    @Query('userId') userId = 'user-001',
  ): Promise<GlobalBalanceDto> {
    return this.wealthService.getGlobalBalance(userId);
  }

  @Get('wealth/accounts')
  async getAccountsDetail(
    @Query('userId') userId = 'user-001',
  ): Promise<AccountBalanceDto[]> {
    return this.wealthService.getAccountsDetail(userId);
  }

  @Get('wealth/timeline')
  async getTimeline(
    @Query('userId') userId = 'user-001',
    @Query('limit') limit = 100,
  ): Promise<TimelineEventDto[]> {
    return this.wealthService.getTimeline(userId, Number(limit));
  }
}
