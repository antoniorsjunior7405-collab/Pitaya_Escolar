import { formatarData, tempoDesde } from '@/lib/formatar';

test('formatarData converte YYYY-MM-DD sem sofrer com fuso', () => {
  expect(formatarData('2026-10-09')).toBe('09/10/2026');
  expect(formatarData('texto-invalido')).toBe('texto-invalido');
});

test('tempoDesde arredonda em linguagem simples', () => {
  const agora = Date.parse('2026-10-09T12:00:00Z');
  expect(tempoDesde('2026-10-09T11:59:30Z', agora)).toBe('agora há pouco');
  expect(tempoDesde('2026-10-09T11:57:00Z', agora)).toBe('há 3 min');
  expect(tempoDesde('2026-10-09T10:00:00Z', agora)).toBe('há 2 h');
  // Relógio do aparelho adiantado não gera tempo negativo.
  expect(tempoDesde('2026-10-09T12:05:00Z', agora)).toBe('agora há pouco');
});
