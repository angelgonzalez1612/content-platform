import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MediaService } from './media.service';
import { saveMediaAssetSchema } from './dto/save-media-asset.dto';

@UseGuards(JwtAuthGuard)
@Controller('cms/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list() {
    return this.media.list();
  }

  @Get('assets')
  listAssets() {
    return this.media.listAssets();
  }

  @Post('assets')
  saveAsset(@Body() body: unknown) {
    return this.media.saveAsset(saveMediaAssetSchema.parse(body));
  }

  @Delete('assets/:id')
  deleteAsset(@Param('id') id: string) {
    return this.media.deleteAsset(id);
  }
}
