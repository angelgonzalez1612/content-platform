import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { FtpStorageService } from './ftp-storage.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, FtpStorageService],
})
export class MediaModule {}
