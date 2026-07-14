import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RetryService } from './retry.service';
import { CircuitBreakerService } from './circuit-breaker.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RetryService, CircuitBreakerService],
  exports: [RetryService, CircuitBreakerService],
})
export class SelfHealingModule {}
