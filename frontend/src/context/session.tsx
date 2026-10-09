import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { ApiError, mensagemDeErro } from '@/lib/http';
import { aoSessaoExpirar } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { renovarTokens } from '@/lib/session-tokens';
import { buscarMe, cadastrar, login, sair } from '@/services/auth';
import type { CadastroInput, MeResponse, Papel } from '@/types/api';

// carregando: ainda verificando se há sessão salva (a splash fica visível)
// anonimo: sem sessão → telas de login/cadastro
// autenticado: sessão válida
// indisponivel: há sessão salva, mas não deu para falar com o servidor (offline ou servidor dormindo)
type Status = 'carregando' | 'anonimo' | 'autenticado' | 'indisponivel';

type SessionContextValue = {
  status: Status;
  dados: MeResponse | null;
  /** Papel na organização atual (por enquanto, a primeira do usuário). */
  papel: Papel | null;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (dados: CadastroInput) => Promise<void>;
  sair: () => Promise<void>;
  /** Só em 'indisponivel': por que não conectou (sem internet, servidor iniciando...). */
  motivoIndisponivel: string | null;
  /** Tentando reconectar agora (a tela de indisponível mostra um indicador, sem sumir). */
  reconectando: boolean;
  tentarNovamente: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type Restauracao =
  | { tipo: 'ok'; me: MeResponse }
  | { tipo: 'anonimo' }
  | { tipo: 'indisponivel'; motivo: string };

// Função pura (sem estado do React): descobre se existe uma sessão válida salva.
async function restaurarSessao(): Promise<Restauracao> {
  try {
    const token = await renovarTokens();
    if (!token) return { tipo: 'anonimo' };
    return { tipo: 'ok', me: await buscarMe() };
  } catch (erro) {
    // Sem conexão/servidor fora: a sessão salva pode estar ótima, então NÃO deslogamos.
    if (erro instanceof ApiError && erro.indisponivel) {
      return { tipo: 'indisponivel', motivo: mensagemDeErro(erro) };
    }
    return { tipo: 'anonimo' };
  }
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<Status>('carregando');
  const [dados, setDados] = useState<MeResponse | null>(null);
  const [motivoIndisponivel, setMotivoIndisponivel] = useState<string | null>(null);
  const [reconectando, setReconectando] = useState(false);

  const aplicar = useCallback((me: MeResponse) => {
    setDados(me);
    setStatus('autenticado');
  }, []);

  const encerrarLocal = useCallback(() => {
    // Apaga os dados em cache: a próxima pessoa a entrar neste aparelho não pode vê-los.
    queryClient.clear();
    setDados(null);
    setStatus('anonimo');
  }, []);

  const aplicarRestauracao = useCallback(
    (resultado: Restauracao) => {
      if (resultado.tipo === 'ok') aplicar(resultado.me);
      else if (resultado.tipo === 'indisponivel') {
        setMotivoIndisponivel(resultado.motivo);
        setStatus('indisponivel');
      }
      else encerrarLocal();
    },
    [aplicar, encerrarLocal],
  );

  // Ao abrir o app: tenta restaurar a sessão salva. O estado só muda quando a resposta
  // chega (e não muda se o componente já saiu da tela).
  useEffect(() => {
    aoSessaoExpirar(encerrarLocal);
    let cancelado = false;
    void restaurarSessao().then((resultado) => {
      if (!cancelado) aplicarRestauracao(resultado);
    });
    return () => {
      cancelado = true;
    };
  }, [aplicarRestauracao, encerrarLocal]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      dados,
      papel: dados?.organizacoes[0]?.papel ?? null,
      entrar: async (email, senha) => aplicar(await login(email, senha)),
      cadastrar: async (input) => aplicar(await cadastrar(input)),
      sair: async () => {
        await sair();
        encerrarLocal();
      },
      motivoIndisponivel,
      reconectando,
      tentarNovamente: async () => {
        // Fica na tela de indisponível (com indicador) em vez de voltar para 'carregando',
        // que não desenha nada e parecia o app travado.
        setReconectando(true);
        try {
          aplicarRestauracao(await restaurarSessao());
        } finally {
          setReconectando(false);
        }
      },
    }),
    [status, dados, motivoIndisponivel, reconectando, aplicar, encerrarLocal, aplicarRestauracao],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession deve ser usado dentro de <SessionProvider>');
  return ctx;
}
