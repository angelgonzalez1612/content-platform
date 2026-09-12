import { Readable } from 'node:stream';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'basic-ftp';
import sharp from 'sharp';

const MAX_DIMENSION = 1600; // lado más largo, en px — de sobra para portadas/galería
const WEBP_QUALITY = 72; // "el menor peso posible" sin verse mal

// Sube imágenes encontradas por el buscador (Wikimedia/Openverse) al hosting
// FTP del cliente — el binario NUNCA toca la base de datos, solo la URL
// pública final (ver media_assets/MediaService). Comprime a WebP antes de
// subir para que pese lo menos posible.
@Injectable()
export class FtpStorageService {
  private readonly logger = new Logger(FtpStorageService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!(this.config.get('FTP_HOST') && this.config.get('FTP_USER') && this.config.get('FTP_PASSWORD') && this.config.get('MEDIA_PUBLIC_BASE_URL'));
  }

  /** Descarga `sourceUrl`, la comprime a WebP, la sube por FTP con un nombre
   * único, y regresa la URL pública final (nunca el binario). */
  async uploadFromUrl(sourceUrl: string, baseName: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new InternalServerErrorException(
        'El hosting FTP no está configurado (faltan FTP_HOST/FTP_USER/FTP_PASSWORD/MEDIA_PUBLIC_BASE_URL) — pídele al administrador que las agregue en Vercel.',
      );
    }

    const res = await fetch(sourceUrl);
    if (!res.ok) throw new InternalServerErrorException(`No se pudo descargar la imagen original (${res.status}).`);
    const original = Buffer.from(await res.arrayBuffer());

    const compressed = await sharp(original)
      .rotate() // respeta EXIF orientation antes de recortar/reducir
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const filename = `${slugify(baseName)}-${Date.now().toString(36)}.webp`;
    const uploadDir = this.config.get<string>('FTP_UPLOAD_DIR')!;

    const client = new Client();
    try {
      await client.access({
        host: this.config.get<string>('FTP_HOST'),
        user: this.config.get<string>('FTP_USER'),
        password: this.config.get<string>('FTP_PASSWORD'),
        port: this.config.get<number>('FTP_PORT'),
        secure: false,
      });
      await client.ensureDir(uploadDir);
      await client.uploadFrom(Readable.from(compressed), filename);
    } catch (e) {
      this.logger.error(`FTP upload falló: ${e instanceof Error ? e.message : e}`);
      throw new InternalServerErrorException('No se pudo subir la imagen al hosting FTP.');
    } finally {
      client.close();
    }

    const base = this.config.get<string>('MEDIA_PUBLIC_BASE_URL')!.replace(/\/$/, '');
    return `${base}/${filename}`;
  }
}

function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60) || 'imagen'
  );
}
