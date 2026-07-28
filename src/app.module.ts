import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { DbModule } from './db/db.module';
import { PlacesModule } from './modules/places/places.module';
import { AuthModule } from './modules/auth/auth.module';
import { AiModule } from './modules/ai/ai.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    DbModule,
    PlacesModule,
    AuthModule,
    AiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
