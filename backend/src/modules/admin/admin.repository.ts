import { and, asc, eq, type SQL } from 'drizzle-orm';
import { ehViolacaoUnica } from '../../db/erros.js';
import type { Db } from '../../db/index.js';
import { schema } from '../../db/index.js';
import type { Papel } from '../../shared/acesso/acesso.js';

// Toda leitura/escrita é restrita à organização do admin (organizacaoId vem da sessão,
// nunca do corpo da requisição).
export interface AdminRepository {
  buscarOrganizacao(
    organizacaoId: string,
  ): Promise<{ nome: string; codigoConvite: string } | undefined>;
  listarMembros(
    organizacaoId: string,
    papel?: Papel,
  ): Promise<{ id: string; nome: string; email: string; telefone: string | null; papel: Papel }[]>;
  buscarMembroPorId(organizacaoId: string, usuarioId: string, papel: Papel): Promise<boolean>;
  buscarMembroPorEmail(
    organizacaoId: string,
    email: string,
    papel: Papel,
  ): Promise<string | undefined>;

  listarVeiculos(organizacaoId: string): Promise<VeiculoRow[]>;
  /** undefined se a placa já existe. */
  criarVeiculo(
    input: Omit<VeiculoRow, 'id'> & { organizacaoId: string },
  ): Promise<VeiculoRow | undefined>;
  veiculoDaOrganizacao(organizacaoId: string, veiculoId: string): Promise<boolean>;

  listarAlunos(organizacaoId: string): Promise<{ id: string; nome: string }[]>;
  criarAluno(organizacaoId: string, nome: string): Promise<{ id: string; nome: string }>;
  alunoDaOrganizacao(organizacaoId: string, alunoId: string): Promise<boolean>;
  buscarAluno(
    organizacaoId: string,
    alunoId: string,
  ): Promise<{ id: string; nome: string } | undefined>;
  listarResponsaveisDoAluno(alunoId: string): Promise<ResponsavelVinculado[]>;
  vincularResponsavel(input: {
    alunoId: string;
    responsavelId: string;
    parentesco: string | null;
  }): Promise<void>;

  listarRotas(organizacaoId: string): Promise<RotaAdminRow[]>;
  buscarRota(organizacaoId: string, rotaId: string): Promise<RotaAdminRow | undefined>;
  listarAlunosDaRota(
    rotaId: string,
  ): Promise<{ id: string; nome: string; ordem: number; endereco: string | null }[]>;
  criarRota(input: {
    organizacaoId: string;
    nome: string;
    periodo: 'MANHA' | 'TARDE' | 'NOITE' | null;
    motoristaId: string;
    veiculoId: string;
  }): Promise<{ id: string }>;
  rotaDaOrganizacao(organizacaoId: string, rotaId: string): Promise<boolean>;
  /** 'ok' | 'duplicado' (aluno já está na rota ou a ordem já está ocupada). */
  adicionarAlunoNaRota(input: {
    rotaId: string;
    alunoId: string;
    ordem: number;
    endereco: string | null;
    latitude: number | null;
    longitude: number | null;
  }): Promise<'ok' | 'duplicado'>;
}

export type VeiculoRow = { id: string; placa: string; modelo: string; capacidade: number | null };
export type ResponsavelVinculado = {
  id: string;
  nome: string;
  email: string;
  parentesco: string | null;
  autorizado: boolean;
};
export type RotaAdminRow = {
  id: string;
  nome: string;
  periodo: 'MANHA' | 'TARDE' | 'NOITE' | null;
  motoristaNome: string;
  veiculoPlaca: string;
};

export function createAdminRepository(db: Db): AdminRepository {
  const {
    organizacoes,
    membros,
    usuarios,
    veiculos,
    alunos,
    responsaveisAlunos,
    rotas,
    rotaAlunos,
  } = schema;

  const existe = async (query: Promise<unknown[]>) => (await query).length > 0;

  const rotasDa = (organizacaoId: string, ...extras: SQL[]) =>
    db
      .select({
        id: rotas.id,
        nome: rotas.nome,
        periodo: rotas.periodo,
        motoristaNome: usuarios.nome,
        veiculoPlaca: veiculos.placa,
      })
      .from(rotas)
      .innerJoin(usuarios, eq(usuarios.id, rotas.motoristaId))
      .innerJoin(veiculos, eq(veiculos.id, rotas.veiculoId))
      .where(and(eq(rotas.organizacaoId, organizacaoId), eq(rotas.ativa, true), ...extras));

  return {
    async buscarOrganizacao(organizacaoId) {
      const [row] = await db
        .select({ nome: organizacoes.nome, codigoConvite: organizacoes.codigoConvite })
        .from(organizacoes)
        .where(eq(organizacoes.id, organizacaoId))
        .limit(1);
      return row;
    },

    listarMembros(organizacaoId, papel) {
      return db
        .select({
          id: usuarios.id,
          nome: usuarios.nome,
          email: usuarios.email,
          telefone: usuarios.telefone,
          papel: membros.papel,
        })
        .from(membros)
        .innerJoin(usuarios, eq(usuarios.id, membros.usuarioId))
        .where(
          and(
            eq(membros.organizacaoId, organizacaoId),
            papel ? eq(membros.papel, papel) : undefined,
          ),
        )
        .orderBy(asc(usuarios.nome));
    },

    buscarMembroPorId: (organizacaoId, usuarioId, papel) =>
      existe(
        db
          .select({ id: membros.usuarioId })
          .from(membros)
          .where(
            and(
              eq(membros.organizacaoId, organizacaoId),
              eq(membros.usuarioId, usuarioId),
              eq(membros.papel, papel),
            ),
          )
          .limit(1),
      ),

    async buscarMembroPorEmail(organizacaoId, email, papel) {
      const [row] = await db
        .select({ id: usuarios.id })
        .from(membros)
        .innerJoin(usuarios, eq(usuarios.id, membros.usuarioId))
        .where(
          and(
            eq(membros.organizacaoId, organizacaoId),
            eq(membros.papel, papel),
            eq(usuarios.email, email),
          ),
        )
        .limit(1);
      return row?.id;
    },

    listarVeiculos: (organizacaoId) =>
      db
        .select({
          id: veiculos.id,
          placa: veiculos.placa,
          modelo: veiculos.modelo,
          capacidade: veiculos.capacidade,
        })
        .from(veiculos)
        .where(and(eq(veiculos.organizacaoId, organizacaoId), eq(veiculos.ativo, true)))
        .orderBy(asc(veiculos.placa)),

    async criarVeiculo(input) {
      try {
        const [row] = await db.insert(veiculos).values(input).returning({
          id: veiculos.id,
          placa: veiculos.placa,
          modelo: veiculos.modelo,
          capacidade: veiculos.capacidade,
        });
        return row;
      } catch (erro) {
        if (ehViolacaoUnica(erro)) return undefined;
        throw erro;
      }
    },

    veiculoDaOrganizacao: (organizacaoId, veiculoId) =>
      existe(
        db
          .select({ id: veiculos.id })
          .from(veiculos)
          .where(and(eq(veiculos.id, veiculoId), eq(veiculos.organizacaoId, organizacaoId)))
          .limit(1),
      ),

    listarAlunos: (organizacaoId) =>
      db
        .select({ id: alunos.id, nome: alunos.nome })
        .from(alunos)
        .where(and(eq(alunos.organizacaoId, organizacaoId), eq(alunos.ativo, true)))
        .orderBy(asc(alunos.nome)),

    async criarAluno(organizacaoId, nome) {
      const [row] = await db
        .insert(alunos)
        .values({ organizacaoId, nome })
        .returning({ id: alunos.id, nome: alunos.nome });
      if (!row) throw new Error('falha ao criar aluno');
      return row;
    },

    alunoDaOrganizacao: (organizacaoId, alunoId) =>
      existe(
        db
          .select({ id: alunos.id })
          .from(alunos)
          .where(and(eq(alunos.id, alunoId), eq(alunos.organizacaoId, organizacaoId)))
          .limit(1),
      ),

    async buscarAluno(organizacaoId, alunoId) {
      const [row] = await db
        .select({ id: alunos.id, nome: alunos.nome })
        .from(alunos)
        .where(and(eq(alunos.id, alunoId), eq(alunos.organizacaoId, organizacaoId)))
        .limit(1);
      return row;
    },

    listarResponsaveisDoAluno: (alunoId) =>
      db
        .select({
          id: usuarios.id,
          nome: usuarios.nome,
          email: usuarios.email,
          parentesco: responsaveisAlunos.parentesco,
          autorizado: responsaveisAlunos.autorizado,
        })
        .from(responsaveisAlunos)
        .innerJoin(usuarios, eq(usuarios.id, responsaveisAlunos.responsavelId))
        .where(eq(responsaveisAlunos.alunoId, alunoId))
        .orderBy(asc(usuarios.nome)),

    async vincularResponsavel(input) {
      await db.insert(responsaveisAlunos).values(input).onConflictDoNothing();
    },

    listarRotas: (organizacaoId) => rotasDa(organizacaoId).orderBy(asc(rotas.nome)),

    async buscarRota(organizacaoId, rotaId) {
      const [row] = await rotasDa(organizacaoId, eq(rotas.id, rotaId)).limit(1);
      return row;
    },

    listarAlunosDaRota: (rotaId) =>
      db
        .select({
          id: alunos.id,
          nome: alunos.nome,
          ordem: rotaAlunos.ordem,
          endereco: rotaAlunos.endereco,
        })
        .from(rotaAlunos)
        .innerJoin(alunos, eq(alunos.id, rotaAlunos.alunoId))
        .where(eq(rotaAlunos.rotaId, rotaId))
        .orderBy(asc(rotaAlunos.ordem)),

    async criarRota(input) {
      const [row] = await db.insert(rotas).values(input).returning({ id: rotas.id });
      if (!row) throw new Error('falha ao criar rota');
      return row;
    },

    rotaDaOrganizacao: (organizacaoId, rotaId) =>
      existe(
        db
          .select({ id: rotas.id })
          .from(rotas)
          .where(and(eq(rotas.id, rotaId), eq(rotas.organizacaoId, organizacaoId)))
          .limit(1),
      ),

    async adicionarAlunoNaRota(input) {
      try {
        await db.insert(rotaAlunos).values(input);
        return 'ok';
      } catch (erro) {
        if (ehViolacaoUnica(erro)) return 'duplicado';
        throw erro;
      }
    },
  };
}
