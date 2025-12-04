import pino, { TransportTargetOptions } from 'pino';
import path from 'path';

const DIR_NAME = __dirname;

const createFileTransportTarget = (level: string): TransportTargetOptions => ({
  target: path.join(DIR_NAME, 'pino.transport.js'),
  level,
  options: {
    destination: '/logs/api.erros.log',
  },
});

const createRollbarTransportTarget = (
  level: string,
): TransportTargetOptions => ({
  target: path.join(DIR_NAME, 'rollbar.transport.js'),
  level,
});

const targets: TransportTargetOptions[] = [
  {
    level: process.env.LOG_LEVEL || 'warn',
    target: 'pino/file',
    options: {
      destination: 1,
    },
  },
  ...(process.env.LOG_TO_FILE === '1'
    ? [
        createFileTransportTarget('error'),
        createFileTransportTarget('warn'),
        createFileTransportTarget('debug'),
      ]
    : []),
  ...(process.env.SLF_ROLLBAR_ACCESS_TOKEN
    ? [
        createRollbarTransportTarget('error'),
        createRollbarTransportTarget('warn'),
        createRollbarTransportTarget('debug'),
      ]
    : []),
];

const transport = pino.transport({
  targets,
});

export const logger = pino(transport);
