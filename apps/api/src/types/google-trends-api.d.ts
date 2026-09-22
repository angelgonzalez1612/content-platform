// google-trends-api no publica sus propios tipos — esta declaración cubre
// solo los dos métodos que usa GoogleTrendsService (interestByRegion,
// relatedQueries). Ambos devuelven el body crudo como string (JSON, o HTML
// cuando Google bloquea la solicitud — ver isJson() en google-trends.service.ts).
declare module 'google-trends-api' {
  interface TrendsOptions {
    keyword: string | string[];
    geo?: string | string[];
    hl?: string;
    resolution?: 'COUNTRY' | 'REGION' | 'CITY' | 'DMA';
    startTime?: Date;
    endTime?: Date;
    category?: number;
  }

  interface GoogleTrendsApi {
    interestByRegion(options: TrendsOptions): Promise<string>;
    relatedQueries(options: TrendsOptions): Promise<string>;
  }

  const googleTrends: GoogleTrendsApi;
  export default googleTrends;
}
