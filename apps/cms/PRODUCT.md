# Product

## Register

product

## Users

Editores/administradores internos de dos medios hermanos operados por el mismo equipo — La Mira (periódico hiperlocal CDMX: noticias, alertas, guías, eventos, lugares, reportajes) y Planazo (directorio de planes: lugares y eventos recomendados). Usan el CMS a diario para generar borradores con IA, editarlos, revisar categorías/plantillas, y monitorear Content Radar (temas en tendencia para saber qué publicar). Trabajan rápido, conocen el dominio a fondo, no son el público final de los sitios — son quienes los alimentan.

## Product Purpose

Un CMS unificado para dos sitios editoriales distintos que comparten infraestructura (misma DB, categorías parcialmente compartidas) pero tienen modelos de contenido y voces propias. Existe para que un equipo chico pueda producir contenido con ayuda de IA (generación, clasificación de sitio/tipo/categoría, mejora de borradores) sin perder control editorial — la IA nunca inventa datos verificables, el humano siempre revisa antes de publicar. Éxito = menos fricción para ir de "tema" a "publicado", con visibilidad clara de qué necesita revisión humana y por qué.

## Brand Personality

Directo, denso en información, sin adorno. Herramienta de trabajo, no vitrina — prioriza que un editor escanee mucha información rápido (20+ categorías, reportes diarios de tendencias, listas largas de contenido) por encima de cualquier impacto visual. Confianza vía claridad: cuando algo es un dato inventado por IA vs. verificado por humano, o cuándo algo aplica a un sitio vs. otro, se nota de un vistazo.

## Anti-references

No debe verse ni sentirse como un dashboard SaaS genérico (gradientes, glassmorphism, hero-metrics). No debe ocultar información detrás de demasiados clics cuando el usuario necesita compararla (ej. categorías compartidas entre sitios). No debe mezclar visualmente los dos sitios (La Mira / Planazo) sin dejar claro cuál es cuál.

## Design Principles

- Lo escaneable primero: en pantallas con muchos ítems (categorías, reportes, temas en tendencia), colapsa por defecto y expande bajo demanda — nunca fuerces scroll largo para ver información que la mayoría de las veces no se necesita completa.
- Los datos reales mandan sobre el mockup: cuando una vista previa o ejemplo representa cómo se vería algo publicado, debe reflejar el modelo de datos real (qué campos existen de verdad para ese tipo/sitio), no un shape genérico reutilizado.
- La distinción entre sitios (La Mira/Planazo) y entre compartido/exclusivo debe ser visible en el lugar donde se toma la decisión, no en documentación aparte.
- Controles compactos, contenido protagonista: los selectores/filtros/tabs ocupan el mínimo espacio necesario y quedan fijos arriba cuando ayuda; el contenido real (lo que se está revisando o publicando) tiene la jerarquía visual más alta.
- Consistencia entre superficies: un mismo patrón (acordeón, badge, selector) se ve y comporta igual en cualquier pantalla del CMS donde aparezca.

## Accessibility & Inclusion

Sin requerimiento WCAG formal declarado. Mantener contraste de texto real (no gris claro decorativo), `prefers-reduced-motion` en cualquier animación nueva, y que los `<details>`/acordeones sigan funcionando sin JavaScript (ya es el patrón establecido en Content Radar).
