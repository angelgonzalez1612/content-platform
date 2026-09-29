import { z } from 'zod';

// Punto de enfoque de una imagen dentro de su recuadro, en el formato de CSS
// `object-position` ("X% Y%", ej. "50% 20%" = centrada, cerca de arriba).
// null = centrada (el default del navegador). Lo usan los sitios al pintar
// la imagen principal con object-fit: cover.
export const imagePositionSchema = z
  .string()
  .regex(/^(100|\d{1,2})% (100|\d{1,2})%$/, 'Formato esperado: "X% Y%" con valores de 0 a 100')
  .nullable()
  .optional();
