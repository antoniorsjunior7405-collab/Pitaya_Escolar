import { buildApp } from './app.js';
import { config } from './config/index.js';
import { createDb } from './db/index.js';
import { createAdminRepository } from './modules/admin/index.js';
import { createAuthRepository, createRecuperacaoRepository } from './modules/auth/index.js';
import { createMotoristaRepository } from './modules/motorista/index.js';
import { createResponsavelRepository } from './modules/responsavel/index.js';
import { createVinculosRepository } from './modules/vinculos/index.js';
import { criarEnviadorResend } from './shared/email/email.js';

const { db, pool } = createDb();
const app = await buildApp({
  authRepository: createAuthRepository(db),
  recuperacaoRepository: createRecuperacaoRepository(db),
  // Sem chave, o buildApp usa o log (em desenvolvimento mostra o link para testar).
  ...(config.EMAIL_RESEND_API_KEY && {
    enviadorEmail: criarEnviadorResend(config.EMAIL_RESEND_API_KEY, config.EMAIL_REMETENTE),
  }),
  motoristaRepository: createMotoristaRepository(db),
  responsavelRepository: createResponsavelRepository(db),
  adminRepository: createAdminRepository(db),
  vinculosRepository: createVinculosRepository(db),
});
if (!config.EMAIL_RESEND_API_KEY && config.NODE_ENV === 'production') {
  app.log.warn(
    'EMAIL_RESEND_API_KEY ausente: os e-mails de recuperação de senha não serão enviados',
  );
}

// Shutdown gracioso: para de aceitar conexões, termina as em andamento e fecha o banco.
let encerrando = false;
async function encerrar(motivo: string, codigo: number) {
  if (encerrando) return;
  encerrando = true;
  app.log.info({ motivo }, 'encerrando');
  // Se algo travar no encerramento, não ficamos pendurados para sempre.
  setTimeout(() => process.exit(codigo || 1), 10_000).unref();
  try {
    await app.close();
    await pool.end();
  } finally {
    process.exit(codigo);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void encerrar(signal, 0));
}

// Erro que ninguém tratou deixa o processo em estado incerto: logamos e saímos
// (o Render reinicia o serviço). Não seguimos rodando.
process.on('unhandledRejection', (reason) => {
  app.log.fatal({ err: reason }, 'unhandledRejection');
  void encerrar('unhandledRejection', 1);
});
process.on('uncaughtException', (err) => {
  app.log.fatal({ err }, 'uncaughtException');
  void encerrar('uncaughtException', 1);
});

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
