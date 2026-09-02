import { Module } from '@nestjs/common';
import { ContentRadarPublishedController } from './content-radar-published.controller';
import { ContentRadarPublishedService } from './content-radar-published.service';

@Module({
  controllers: [ContentRadarPublishedController],
  providers: [ContentRadarPublishedService],
  exports: [ContentRadarPublishedService],
})
export class ContentRadarPublishedModule {}
