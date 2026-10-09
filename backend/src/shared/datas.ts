import { config } from '../config/index.js';

const formatador = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.TZ_NEGOCIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Data de hoje (YYYY-MM-DD) no fuso do negócio. O servidor roda em UTC: sem isto, uma
 * viagem iniciada às 21h no Brasil seria registrada no "dia seguinte".
 */
export function hojeNoFusoDoNegocio(agora = new Date()): string {
  return formatador.format(agora);
}
