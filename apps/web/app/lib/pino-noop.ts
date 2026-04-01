const noop = () => {};
const logger = {
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop,
  silent: noop,
  child: () => logger,
  bindings: () => ({}),
  level: "silent",
};

export const levels = {
  values: {
    fatal: 60,
    error: 50,
    warn: 40,
    info: 30,
    debug: 20,
    trace: 10,
  },
  labels: {
    60: "fatal",
    50: "error",
    40: "warn",
    30: "info",
    20: "debug",
    10: "trace",
  },
};

export default function pino(_opts?: unknown, _stream?: unknown) {
  return logger;
}

export { pino };
