// DADOS FICTÍCIOS E TEMPORÁRIOS.
// Existem só para visualizar e testar a navegação (Tarefa 1.1).
// As telas NÃO importam dados direto: elas chamam estas funções. Quando o backend
// existir (decisão pendente), troca-se o conteúdo daqui (provavelmente para async)
// e as telas mudam pouco.

import type { Filho, Rota, ViagemHistorico } from '@/types';

const ROTAS: Rota[] = [
  {
    id: 'rota-1',
    nome: 'Rota Manhã - Centro',
    veiculo: { placa: 'ABC-1D23', modelo: 'Van Sprinter' },
    alunos: [
      { id: 'aluno-1', nome: 'Ana Souza' },
      { id: 'aluno-2', nome: 'Bruno Lima' },
      { id: 'aluno-3', nome: 'Carla Mendes' },
    ],
  },
  {
    id: 'rota-2',
    nome: 'Rota Tarde - Jardim América',
    veiculo: { placa: 'XYZ-9K88', modelo: 'Micro-ônibus' },
    alunos: [
      { id: 'aluno-4', nome: 'Daniel Rocha' },
      { id: 'aluno-5', nome: 'Eduarda Alves' },
    ],
  },
];

const HISTORICO: ViagemHistorico[] = [
  { id: 'viagem-10', rotaNome: 'Rota Manhã - Centro', data: '07/10/2026', totalAlunos: 3 },
  { id: 'viagem-9', rotaNome: 'Rota Tarde - Jardim América', data: '06/10/2026', totalAlunos: 2 },
  { id: 'viagem-8', rotaNome: 'Rota Manhã - Centro', data: '06/10/2026', totalAlunos: 3 },
];

const FILHOS: Filho[] = [
  {
    id: 'aluno-1',
    nome: 'Ana Souza',
    statusViagem: 'EM_ANDAMENTO',
    statusAluno: 'EMBARCADO',
    motoristaNome: 'Carlos Pereira',
    veiculo: { placa: 'ABC-1D23', modelo: 'Van Sprinter' },
  },
  {
    id: 'aluno-6',
    nome: 'Pedro Souza',
    statusViagem: 'PLANEJADA',
    statusAluno: 'AGUARDANDO',
    motoristaNome: 'Marta Oliveira',
    veiculo: { placa: 'XYZ-9K88', modelo: 'Micro-ônibus' },
  },
];

export function getRotas(): Rota[] {
  return ROTAS;
}

export function getRota(id: string): Rota | undefined {
  return ROTAS.find((rota) => rota.id === id);
}

export function getHistorico(): ViagemHistorico[] {
  return HISTORICO;
}

export function getFilhos(): Filho[] {
  return FILHOS;
}

export function getFilho(id: string): Filho | undefined {
  return FILHOS.find((filho) => filho.id === id);
}
