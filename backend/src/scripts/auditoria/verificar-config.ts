import type { Config } from '../../config/index.js';
import { aviso, falha, ok, type Resultado } from './resultado.js';

export type ConfigAuditavel = Pick<
  Config,
  'NODE_ENV' | 'LOG_LEVEL' | 'CORS_ORIGINS' | 'DATABASE_URL' | 'JWT_SECRET' | 'ACCESS_TOKEN_TTL'
> & { REFRESH_TOKEN_TTL_DAYS: number };

/** Valor de exemplo do .env.example: nunca pode chegar a um ambiente real. */
const SEGREDO_DE_EXEMPLO = 'troque-por-um-segredo-longo-e-aleatorio-com-32-ou-mais-caracteres';

const SEGUNDOS_POR_UNIDADE: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

/** Converte "15m", "1h", "900" (segundos) em segundos. Formato desconhecido → null. */
export function ttlEmSegundos(ttl: string): number | null {
  const m = /^(\d+)\s*([smhd])?$/.exec(ttl.trim());
  if (!m?.[1]) return null;
  return Number(m[1]) * (SEGUNDOS_POR_UNIDADE[m[2] ?? 's'] ?? 1);
}

function hostLocal(url: string): boolean {
  try {
    return ['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Regras de configuração (backend/BOAS_PRATICAS.md §5, §9, §12). Função pura. */
export function verificarConfig(c: ConfigAuditavel): Resultado[] {
  const r: Resultado[] = [];
  const producao = c.NODE_ENV === 'production';

  // JWT_SECRET: quem conhece o segredo emite tokens de qualquer usuário, inclusive ADMIN.
  const segredo = c.JWT_SECRET;
  if (segredo === SEGREDO_DE_EXEMPLO) {
    r.push(falha('JWT_SECRET', 'é o valor de exemplo do .env.example'));
  } else if (new Set(segredo).size < 16) {
    r.push(falha('JWT_SECRET', 'pouca variedade de caracteres: parece previsível'));
  } else if (producao && segredo.length < 48) {
    r.push(aviso('JWT_SECRET', `${segredo.length} caracteres; em produção use 48+ aleatórios`));
  } else {
    r.push(ok('JWT_SECRET'));
  }

  const ttl = ttlEmSegundos(c.ACCESS_TOKEN_TTL);
  if (ttl === null) {
    r.push(aviso('ACCESS_TOKEN_TTL', `formato não reconhecido: "${c.ACCESS_TOKEN_TTL}"`));
  } else if (ttl > 3600) {
    // O papel vai dentro do token: um TTL longo atrasa a perda de acesso de quem foi removido.
    r.push(falha('ACCESS_TOKEN_TTL', `${ttl}s; o access token deve durar no máximo 1 h`));
  } else {
    r.push(ok('ACCESS_TOKEN_TTL', `${ttl}s`));
  }

  if (c.REFRESH_TOKEN_TTL_DAYS > 90) {
    r.push(aviso('REFRESH_TOKEN_TTL_DAYS', `${c.REFRESH_TOKEN_TTL_DAYS} dias; prefira até 90`));
  } else {
    r.push(ok('REFRESH_TOKEN_TTL_DAYS', `${c.REFRESH_TOKEN_TTL_DAYS} dias`));
  }

  if (c.CORS_ORIGINS.includes('*')) {
    r.push(falha('CORS_ORIGINS', 'contém "*": qualquer site pode chamar a API pelo navegador'));
  } else if (producao && c.CORS_ORIGINS.some(hostLocal)) {
    r.push(aviso('CORS_ORIGINS', 'produção aceitando origem localhost'));
  } else {
    r.push(ok('CORS_ORIGINS', c.CORS_ORIGINS.length ? c.CORS_ORIGINS.join(', ') : 'nenhuma'));
  }

  if (c.DATABASE_URL && !hostLocal(c.DATABASE_URL)) {
    const sslmode = new URL(c.DATABASE_URL).searchParams.get('sslmode');
    if (!sslmode || ['disable', 'allow', 'prefer'].includes(sslmode)) {
      r.push(falha('DATABASE_URL', 'banco remoto sem sslmode=require (dados trafegam sem TLS)'));
    } else {
      r.push(ok('DATABASE_URL', `sslmode=${sslmode}`));
    }
  }

  if (producao && ['debug', 'trace'].includes(c.LOG_LEVEL)) {
    r.push(aviso('LOG_LEVEL', `"${c.LOG_LEVEL}" em produção pode registrar dados pessoais`));
  } else {
    r.push(ok('LOG_LEVEL', c.LOG_LEVEL));
  }

  return r;
}
