import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AutomationModule } from '../automation/automation.module';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [AiModule, AutomationModule],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
