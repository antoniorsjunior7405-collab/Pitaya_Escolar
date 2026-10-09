import type { StatusViagem, TipoEvento } from '../../db/consultas.js';
import { RegraDeNegocioError } from '../../shared/errors/app-error.js';

// Regras da viagem (RN-08: PLANEJADA → EM_ANDAMENTO → FINALIZADA, sem volta).
// Funções puras: sem banco, testáveis isoladamente. O service as aplica antes de gravar.

export function garantirEmAndamento(status: StatusViagem) {
  if (status !== 'EM_ANDAMENTO') {
    throw new RegraDeNegocioError(
      status === 'FINALIZADA'
        ? 'Esta viagem já foi finalizada'
        : 'Inicie a viagem antes de registrar embarques e entregas',
    );
  }
}

/** Entregar exige ter embarcado antes (a entrega sem embarque não faz sentido no transporte). */
export function garantirOrdemDoEvento(tipo: TipoEvento, jaEmbarcou: boolean) {
  if (tipo === 'ENTREGUE' && !jaEmbarcou) {
    throw new RegraDeNegocioError('O aluno precisa embarcar antes de ser entregue');
  }
}

/** Finalizar só a partir de EM_ANDAMENTO. Finalizar de novo é aceito (idempotente). */
export function podeFinalizar(status: StatusViagem): 'finalizar' | 'ja-finalizada' {
  if (status === 'FINALIZADA') return 'ja-finalizada';
  if (status !== 'EM_ANDAMENTO') {
    throw new RegraDeNegocioError('Só é possível finalizar uma viagem em andamento');
  }
  return 'finalizar';
}
