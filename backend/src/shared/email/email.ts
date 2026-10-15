// Envio de e-mail transacional. Os módulos só conhecem esta interface: em produção é o
// Resend, em desenvolvimento o log, e nos testes uma versão que guarda as mensagens.
export type MensagemEmail = { para: string; assunto: string; texto: string };

export interface EnviadorEmail {
  enviar(mensagem: MensagemEmail): Promise<void>;
}

/** Só o necessário do logger do Fastify (pino). */
type Log = {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
};

/**
 * Resend via HTTP (https://resend.com/docs/api-reference/emails/send-email), com fetch
 * nativo: sem dependência nova. Timeout curto para nunca segurar o processo.
 */
export function criarEnviadorResend(apiKey: string, remetente: string): EnviadorEmail {
  return {
    async enviar({ para, assunto, texto }) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: remetente, to: [para], subject: assunto, text: texto }),
        signal: AbortSignal.timeout(10_000),
      });
      // Só o status: o corpo da resposta pode ecoar o destinatário (dado pessoal).
      if (!res.ok) throw new Error(`Resend respondeu ${res.status}`);
    },
  };
}

/**
 * Sem provedor configurado. Em desenvolvimento mostra a mensagem no log (é o jeito de
 * testar o fluxo localmente). Fora dele NUNCA registra o conteúdo, que tem o link com o
 * token: só avisa que o e-mail não foi enviado.
 */
export function criarEnviadorDeLog(log: Log, desenvolvimento: boolean): EnviadorEmail {
  return {
    async enviar(mensagem) {
      if (desenvolvimento) log.info({ email: mensagem }, 'e-mail (dev: não enviado de verdade)');
      else log.warn({ assunto: mensagem.assunto }, 'e-mail não enviado: provedor não configurado');
    },
  };
}
