import { buildApp } from './app.js';
import { config } from './config/index.js';

const app = await buildApp();

// Shutdown gracioso: para de aceitar conexões e termina as em andamento.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info({ signal }, 'encerrando');
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
