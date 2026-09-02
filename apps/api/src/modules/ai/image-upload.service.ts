import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — de sobra para una foto real, sin abrir la puerta a archivos gigantes.
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// Subida manual de imágenes (además de buscarlas o pegar una URL) — se
// guardan en disco local (apps/api/uploads/, gitignored) y se sirven tal
// cual vía app.useStaticAssets (ver main.ts). Sin bucket externo por ahora —
// mismo criterio que el resto del proyecto (SQLite local en vez de un
// servicio de DB externo) hasta que haga falta escalar de verdad.
@Injectable()
export class ImageUploadService {
  save(file: Express.Multer.File, publicOrigin: string): { url: string; filename: string } {
    if (!file) throw new BadRequestException('No se recibió ningún archivo.');
    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) throw new BadRequestException(`Tipo de archivo no permitido: "${file.mimetype}". Solo JPEG, PNG, WEBP o GIF.`);
    if (file.size > MAX_SIZE_BYTES) throw new BadRequestException('El archivo pesa más de 8MB.');

    mkdirSync(UPLOAD_DIR, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    writeFileSync(join(UPLOAD_DIR, filename), file.buffer);

    return { url: `${publicOrigin}/uploads/${filename}`, filename };
  }
}
