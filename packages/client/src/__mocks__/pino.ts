const noop = () => undefined;

const stubLogger = {
  info: noop,
  error: noop,
  warn: noop,
  debug: noop,
  fatal: noop,
  trace: noop,
  child: () => stubLogger,
};

export default function pino() {
  return stubLogger;
}

export { pino as default, stubLogger };
