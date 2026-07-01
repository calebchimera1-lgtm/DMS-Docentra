import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { initSocket } from './sockets';

async function main() {
  const app = createApp();
  const server = http.createServer(app);

  initSocket(server);

  server.listen(env.port, () => {
    logger.info(`Docentra backend listening on port ${env.port} [${env.nodeEnv}]`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal error during startup', { error: err });
  process.exit(1);
});
