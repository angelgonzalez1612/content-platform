import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { locations } from '../../db/schema';

export interface LocationDto {
  slug: string;
  name: string;
  kind: 'alcaldia' | 'municipio';
}

@Injectable()
export class LocationsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findAll(kind?: 'alcaldia' | 'municipio'): Promise<LocationDto[]> {
    return this.db.query.locations.findMany({
      where: kind ? eq(locations.kind, kind) : undefined,
      orderBy: (l, { asc }) => [asc(l.name)],
    });
  }
}
