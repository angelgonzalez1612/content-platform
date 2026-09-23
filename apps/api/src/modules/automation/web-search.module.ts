import { Module } from '@nestjs/common';
import { WebSearchService } from './web-search.service';

// Módulo chico aparte (en vez de declarar WebSearchService directo en
// AutomationModule) para que EntidadesModule lo pueda reusar (búsquedas
// locales por municipio/alcaldía) sin arrastrar todo AutomationModule —
// que trae AiModule + media docena de módulos de contenido encima, peso
// innecesario para lo que en el fondo es una sola llamada a Custom Search.
@Module({
  providers: [WebSearchService],
  exports: [WebSearchService],
})
export class WebSearchModule {}
