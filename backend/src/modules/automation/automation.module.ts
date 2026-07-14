import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { Automation } from './automation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Automation]),
    ScheduleModule.forRoot(),
  ],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
