function envStr(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}
function envNum(key: string, fallback: number): number {
  const v = process.env[key];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export interface AppConfig {
  host: string;
  port: number;
  /** HMAC secret used to bind MPP challenges. */
  secret: string;
  /** Base URL the server uses to call its OWN paid services (table-as-client). */
  publicBaseUrl: string;
  /** Whether the table auto-starts hands while >=2 funded players are seated. */
  autoPlay: boolean;
  /** Pause (ms) between hands when auto-playing. */
  handIntervalMs: number;
  /** Per-turn deadline (ms) before the table auto-acts for a silent agent. */
  turnTimeoutMs: number;
  /** How long the final board + winner lingers before the next hand. */
  showdownDelayMs: number;
  /** Minimum players the controller keeps seated (fills with house bots). */
  minPlayers: number;
  /** Real-time "think time" range for controller-spawned agents. */
  agentThinkMinMs: number;
  agentThinkMaxMs: number;
  anthropicApiKey: string | null;
}

export function loadConfig(): AppConfig {
  const port = envNum('PORT', 4020);
  return {
    host: envStr('HOST', '127.0.0.1'),
    port,
    secret: envStr('MPP_SECRET', 'table402-dev-secret-do-not-use-in-prod'),
    publicBaseUrl: envStr('PUBLIC_BASE_URL', `http://127.0.0.1:${port}`),
    autoPlay: envStr('AUTO_PLAY', 'true') !== 'false',
    handIntervalMs: envNum('HAND_INTERVAL_MS', 3000),
    turnTimeoutMs: envNum('TURN_TIMEOUT_MS', 30_000),
    showdownDelayMs: envNum('SHOWDOWN_DELAY_MS', 2000),
    minPlayers: envNum('MIN_PLAYERS', 3),
    agentThinkMinMs: envNum('AGENT_THINK_MIN_MS', 1300),
    agentThinkMaxMs: envNum('AGENT_THINK_MAX_MS', 2800),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? null,
  };
}
