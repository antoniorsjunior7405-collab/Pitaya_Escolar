import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Acesso ao código-fonte auditado. As regras recebem isto por parâmetro: o script usa o
 * disco e os testes usam arquivos em memória, então as mesmas regras valem para os dois.
 */
export type Fontes = {
  /** Arquivos .ts da aplicação (caminhos relativos a backend/), sem testes. */
  arquivos: readonly string[];
  /** Conteúdo do arquivo; '' se não existir. */
  ler(arquivo: string): string;
  /** "arquivo:linha" para o relatório (o terminal do VS Code transforma em link). */
  local(arquivo: string, linha: number): string;
};

/**
 * Só o código da aplicação. src/scripts fica de fora: as auditorias citam os próprios
 * padrões ("esqueci", "reset"...) e seriam confundidas com o fluxo de recuperação.
 */
export const PASTAS_AUDITADAS = ['src/modules', 'src/db', 'src/config', 'src/shared'] as const;

export const ehFonteDaAplicacao = (arquivo: string) =>
  arquivo.endsWith('.ts') &&
  !arquivo.endsWith('.test.ts') &&
  PASTAS_AUDITADAS.some((p) => arquivo.startsWith(`${p}/`));

/** Fontes lidas do disco. `raiz` é a pasta backend/. */
export function criarFontesDoDisco(raiz: string, cwd = process.cwd()): Fontes {
  const cache = new Map<string, string>();

  function ler(arquivo: string): string {
    const salvo = cache.get(arquivo);
    if (salvo !== undefined) return salvo;
    let texto = '';
    try {
      // Caminhos vêm só das constantes das regras e da listagem abaixo, nunca de entrada externa.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      texto = readFileSync(path.join(raiz, arquivo), 'utf8');
    } catch {
      // arquivo ausente: as regras tratam '' como "não encontrado"
    }
    cache.set(arquivo, texto);
    return texto;
  }

  function listar(dir: string): string[] {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      return readdirSync(path.join(raiz, dir), { withFileTypes: true }).flatMap((e) => {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) return listar(rel);
        return ehFonteDaAplicacao(rel) ? [rel] : [];
      });
    } catch {
      return [];
    }
  }

  return {
    arquivos: PASTAS_AUDITADAS.flatMap((p) => listar(p)),
    ler,
    local: (arquivo, linha) => `${path.relative(cwd, path.join(raiz, arquivo))}:${linha}`,
  };
}
