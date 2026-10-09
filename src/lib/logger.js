const ts = () => new Date().toISOString();

function fmt(level, msg, meta) {
  const base = `[${ts()}] [${level}] ${msg}`;
  if (!meta) return base;
  try {
    return `${base} ${JSON.stringify(meta)}`;
  } catch {
    return `${base} [unserializable meta]`;
  }
}

export const logger = {
  info: (msg, meta) => console.log(fmt('info', msg, meta)),
  warn: (msg, meta) => console.warn(fmt('warn', msg, meta)),
  error: (msg, meta) => console.error(fmt('error', msg, meta)),
  debug: (msg, meta) => {
    if (process.env.DEBUG) console.log(fmt('debug', msg, meta));
  }
};
