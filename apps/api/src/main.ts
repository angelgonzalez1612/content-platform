import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);

  // HMR del watch de Nest (ver webpack-hmr.config.js) — reemplaza el módulo
  // en el mismo proceso en vez de matar/relanzar el proceso compilado, que
  // en esta máquina crasheaba todo `pnpm dev` seguido (taskkill fallando al
  // reiniciar). `module` solo existe bajo el builder de webpack.
  const hot = (module as unknown as { hot?: { accept(): void; dispose(cb: () => void): void } }).hot;
  if (hot) {
    hot.accept();
    hot.dispose(() => app.close());
  }
}
void bootstrap();
