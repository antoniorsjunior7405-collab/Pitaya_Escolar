import { aviso, falha, ok, type Resultado } from './resultado.js';

export type Resposta = {
  status: number;
  headers: Record<string, string | undefined>;
  body: string;
};

/**
 * Faz uma requisição GET à API. Recebe só o caminho: o script usa fetch contra a URL
 * real e os testes usam app.inject, então as mesmas regras valem para os dois.
 */
export type Requisitar = (caminho: string, headers?: Record<string, string>) => Promise<Resposta>;

const ORIGEM_ESTRANHA = 'https://origem-nao-autorizada.example';

// Token com "alg: none" e papel ADMIN: a API precisa recusar (ataque clássico de JWT).
const TOKEN_FORJADO =
  Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') +
  '.' +
  Buffer.from(JSON.stringify({ sub: 'auditoria', m: [{ o: 'x', p: 'ADMIN' }] })).toString(
    'base64url',
  ) +
  '.';

/** Corpo de erro no formato padrão { code, message, requestId }, sem detalhes internos. */
function verificarCorpoDeErro(item: string, body: string): Resultado {
  if (/\bstack\b|at \S+ \(|node_modules|SELECT |INSERT /i.test(body)) {
    return falha(item, 'resposta de erro expõe detalhes internos (stack/SQL)');
  }
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    if (typeof json.code === 'string' && typeof json.requestId === 'string') return ok(item);
  } catch {
    // cai no aviso abaixo
  }
  return aviso(item, 'erro fora do formato { code, message, requestId }');
}

/** Regras de HTTP (backend/BOAS_PRATICAS.md §8, §9, §12). Só faz GETs: não altera nada. */
export async function verificarHttp(requisitar: Requisitar, https: boolean): Promise<Resultado[]> {
  const r: Resultado[] = [];

  const health = await requisitar('/health', { Origin: ORIGEM_ESTRANHA });
  // 5xx aqui costuma ser o proxy (ex.: Render acordando o servidor), não a nossa API:
  // avaliar os headers dessa página geraria falsos positivos, então paramos.
  if (health.status >= 500) {
    return [
      falha(
        'API indisponível',
        `GET /health respondeu ${health.status}; servidor fora do ar ou acordando. Rode de novo em ~1 min`,
      ),
    ];
  }
  const h = health.headers;
  r.push(
    health.status === 200 ? ok('GET /health') : falha('GET /health', `status ${health.status}`),
  );
  r.push(
    h['x-powered-by']
      ? falha('X-Powered-By', `revela a tecnologia do servidor: "${h['x-powered-by']}"`)
      : ok('X-Powered-By ausente'),
  );
  r.push(
    h['x-content-type-options'] === 'nosniff'
      ? ok('X-Content-Type-Options')
      : falha('X-Content-Type-Options', 'ausente (helmet desligado?)'),
  );
  r.push(
    h['x-frame-options'] || /frame-ancestors/.test(h['content-security-policy'] ?? '')
      ? ok('Proteção contra clickjacking')
      : falha('Proteção contra clickjacking', 'sem X-Frame-Options nem CSP frame-ancestors'),
  );
  if (https) {
    r.push(
      h['strict-transport-security']
        ? ok('Strict-Transport-Security')
        : falha('Strict-Transport-Security', 'ausente: navegador pode cair para HTTP'),
    );
  }

  const cors = h['access-control-allow-origin'];
  r.push(
    cors === '*' || cors === ORIGEM_ESTRANHA
      ? falha('CORS', `aceitou origem não autorizada (${cors})`)
      : ok('CORS recusa origem não autorizada'),
  );

  const semToken = await requisitar('/v1/auth/me');
  r.push(
    semToken.status === 401
      ? ok('Rota protegida sem token → 401')
      : falha('Rota protegida sem token', `esperado 401, veio ${semToken.status}`),
  );
  r.push(verificarCorpoDeErro('Formato do erro 401', semToken.body));

  const forjado = await requisitar('/v1/admin/alunos', {
    Authorization: `Bearer ${TOKEN_FORJADO}`,
  });
  r.push(
    forjado.status === 401
      ? ok('Token forjado (alg none, ADMIN) → 401')
      : falha('Token forjado (alg none, ADMIN)', `esperado 401, veio ${forjado.status}`),
  );

  const inexistente = await requisitar('/rota-inexistente-auditoria');
  r.push(
    inexistente.status === 404
      ? verificarCorpoDeErro('Rota inexistente → 404', inexistente.body)
      : aviso('Rota inexistente', `esperado 404, veio ${inexistente.status}`),
  );

  return r;
}
