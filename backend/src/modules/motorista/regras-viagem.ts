import type { StatusViagem } from '../../db/consultas.js';
import { RegraDeNegocioError } from '../../shared/errors/app-error.js';
import type { StatusAluno } from '../../shared/status-aluno.js';
import type { TipoEventoInput } from './motorista.schemas.js';

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

/**
 * Entregar exige ter embarcado antes (a entrega sem embarque não faz sentido no transporte).
 * Falta só antes do embarque. Embarcar depois de uma falta é aceito: corrige a falta.
 */
export function garantirOrdemDoEvento(tipo: TipoEventoInput, situacao: StatusAluno) {
  const embarcou = situacao === 'EMBARCADO' || situacao === 'ENTREGUE';
  if (tipo === 'ENTREGUE' && !embarcou) {
    throw new RegraDeNegocioError('O aluno precisa embarcar antes de ser entregue');
  }
  if (tipo === 'AUSENTE' && embarcou) {
    throw new RegraDeNegocioError('O aluno já embarcou: registre a entrega');
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

/**
 * A viagem só termina quando todo aluno da rota tem um desfecho: entregue ou ausente.
 * Nenhuma criança pode ficar "embarcada" (ou sem registro) numa viagem finalizada.
 */
export function garantirTodosAtendidos(situacoes: StatusAluno[]) {
  const pendentes = situacoes.filter((s) => s !== 'ENTREGUE' && s !== 'AUSENTE').length;
  if (pendentes === 0) return;
  throw new RegraDeNegocioError(
    pendentes === 1
      ? 'Falta registrar a entrega ou a falta de 1 aluno antes de finalizar'
      : `Falta registrar a entrega ou a falta de ${pendentes} alunos antes de finalizar`,
  );
}
