import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './indicators/database.health.indicator';
import { RedisHealthIndicator } from './indicators/redis.health.indicator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly dbHealth: DatabaseHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check application health' })
  check() {
    return this.health.check([
      () => this.dbHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }

  @Get('db')
  @HealthCheck()
  @ApiOperation({ summary: 'Check database health only' })
  checkDatabase() {
    return this.health.check([() => this.dbHealth.isHealthy('database')]);
  }

  @Get('redis')
  @HealthCheck()
  @ApiOperation({ summary: 'Check Redis health only' })
  checkRedis() {
    return this.health.check([() => this.redisHealth.isHealthy('redis')]);
  }
}
