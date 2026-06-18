/**
 * Suppress the Node `ExperimentalWarning` emitted by the built-in `node:sqlite`
 * module so the demo console stays clean. Imported for its side effect before
 * any `node:sqlite` usage.
 */
const original = process.emitWarning.bind(process);
(process as unknown as { emitWarning: (...args: unknown[]) => void }).emitWarning = (
  warning: unknown,
  ...rest: unknown[]
) => {
  const message = typeof warning === 'string' ? warning : (warning as Error | undefined)?.message;
  if (typeof message === 'string' && message.includes('SQLite')) return;
  (original as unknown as (...args: unknown[]) => void)(warning, ...rest);
};

export {};
