import abstractTransport from 'pino-abstract-transport';
import Rollbar from 'rollbar';

const defaultOpts = {
  rollbarOpts: {},
  logErrors: true,
  // Factory method for Rollbar instance
  _rollbarFactory: (rollbarOpts) =>
    new Rollbar({
      accessToken: process.env.SLF_ROLLBAR_ACCESS_TOKEN,
      captureUncaught: true,
      captureUnhandledRejections: true,
      environment: process.env.APP_ENVIRONMENT,
      nodeSourceMaps: true,
      autoInstrument: true,
      ...rollbarOpts,
    }),
};

function pinoLevelToRollbar(level) {
  if (!Number.isInteger(level)) {
    return new Error('level is not a number - ' + level);
  }
  if (level < 30) return 'debug';
  if (level < 40) return 'info';
  if (level < 50) return 'warning';
  if (level < 60) return 'error';
  return 'critical';
}

module.exports = async function (opts) {
  const options = { ...defaultOpts, ...opts };
  let rollbar = options._rollbarFactory(options.rollbarOpts);

  const stream = abstractTransport(
    async function (source) {
      for await (const obj of source) {
        const { msg, level, user, ...props } = obj;
        const rollbarLevel = pinoLevelToRollbar(level);

        if (options.logErrors && rollbarLevel instanceof Error) {
          console.error(rollbarLevel);
          continue;
        }

        rollbar.configure({
          payload: {
            environment: process.env.APP_ENVIRONMENT,
            person: user || {},
          },
        });

        if (['error', 'critical', 'warning', 'debug'].includes(rollbarLevel)) {
          rollbar[rollbarLevel](
            msg || '',
            { level: rollbarLevel, ...props },
            (error) => {
              if (options.logErrors && error) {
                console.error(error);
              }
            },
          );
        }
      }
    },
    {
      close: (error, cb) => {
        if (options.logErrors && error) {
          console.error(error);
        }
        rollbar.wait(cb);
        rollbar = null;
      },
    },
  );

  return stream;
};
