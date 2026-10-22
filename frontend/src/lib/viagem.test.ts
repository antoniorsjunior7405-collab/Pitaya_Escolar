import { acoesDoAluno, alunosPendentes, motivoParaNaoFinalizar } from '@/lib/viagem';
import type { AlunoDaRota, StatusAluno } from '@/types';

const aluno = (status: StatusAluno): AlunoDaRota => ({
  id: status,
  nome: 'Ana',
  ordem: 1,
  endereco: null,
  status,
  chegadaConfirmada: false,
});

test('aguardando pode embarcar ou faltar; embarcado só pode ser entregue; entregue não tem ações', () => {
  expect(acoesDoAluno('AGUARDANDO').map((a) => a.tipo)).toEqual(['EMBARCADO', 'AUSENTE']);
  expect(acoesDoAluno('EMBARCADO').map((a) => a.tipo)).toEqual(['ENTREGUE']);
  expect(acoesDoAluno('ENTREGUE')).toEqual([]);
});

test('quem faltou ainda pode embarcar (a criança apareceu depois)', () => {
  expect(acoesDoAluno('AUSENTE').map((a) => a.tipo)).toEqual(['EMBARCADO']);
});

test('finalizar fica bloqueado enquanto algum aluno não foi entregue nem marcado como ausente', () => {
  const todos = [aluno('ENTREGUE'), aluno('AUSENTE')];
  expect(alunosPendentes(todos)).toBe(0);
  expect(motivoParaNaoFinalizar(0)).toBeNull();

  expect(alunosPendentes([...todos, aluno('EMBARCADO')])).toBe(1);
  expect(motivoParaNaoFinalizar(1)).toMatch(/do aluno que falta/);
  expect(alunosPendentes([aluno('AGUARDANDO'), aluno('EMBARCADO')])).toBe(2);
  expect(motivoParaNaoFinalizar(2)).toMatch(/dos 2 alunos/);
});
