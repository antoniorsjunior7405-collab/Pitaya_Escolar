// Formatação de datas para exibição (pt-BR).

/** "2026-10-09" → "09/10/2026" (sem passar por Date, para não sofrer com fuso). */
export function formatarData(isoData: string): string {
  const [ano, mes, dia] = isoData.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : isoData;
}

export function formatarHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** "agora há pouco", "há 3 min", "há 2 h". */
export function tempoDesde(iso: string, agora = Date.now()): string {
  const segundos = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 1000));
  if (segundos < 60) return 'agora há pouco';
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  return `há ${Math.round(minutos / 60)} h`;
}
