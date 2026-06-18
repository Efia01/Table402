import type { FastifyInstance } from 'fastify';
import { SERVICE_FEES, SERVICE_IDS } from '@table402/shared';
import type { AppContext } from '../core/context';
import { registerPaidService } from './paid-service';

export interface CommentaryInput {
  handId?: string;
  number?: number;
  board?: string[];
  potChips?: number;
  street?: string;
  winners?: Array<{ label: string; amount: number; handName?: string }>;
  bustedShowdown?: boolean;
  biggestAction?: { label: string; type: string; amount: number } | null;
  playerCount?: number;
}

interface CommentaryResult {
  summary: string;
  bestMove: string;
  source: 'claude' | 'template';
}

function templateCommentary(input: CommentaryInput): CommentaryResult {
  const winner = input.winners?.[0];
  const board = input.board?.length ? input.board.join(' ') : 'no community cards';
  const pot = input.potChips != null ? `${input.potChips} simulation chips` : 'the pot';
  const parts: string[] = [];
  parts.push(`Hand #${input.number ?? '?'} resolved on the ${input.street ?? 'final'} street.`);
  parts.push(`Board: ${board}.`);
  if (winner) {
    parts.push(
      `${winner.label} took down ${pot}${winner.handName ? ` with ${winner.handName}` : ''}.`,
    );
  } else {
    parts.push(`The ${pot} was pushed across the felt.`);
  }
  if (input.biggestAction) {
    parts.push(
      `Key move: ${input.biggestAction.label} chose to ${input.biggestAction.type}` +
        (input.biggestAction.amount ? ` for ${input.biggestAction.amount}.` : '.'),
    );
  }
  const bestMove = input.biggestAction
    ? `${input.biggestAction.label}'s ${input.biggestAction.type} set the tempo — disciplined aggression with position is the read.`
    : winner
      ? `${winner.label} maximised value by staying patient until the right spot.`
      : 'Pot control and position were the difference this hand.';
  return { summary: parts.join(' '), bestMove, source: 'template' };
}

async function claudeCommentary(input: CommentaryInput, apiKey: string): Promise<CommentaryResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const prompt =
      `You are a witty but concise poker commentator for a testnet simulation (simulation chips only). ` +
      `Given this completed hand, reply with strict JSON {"summary": string, "bestMove": string}. ` +
      `Keep summary under 240 chars and bestMove under 160 chars. Hand: ${JSON.stringify(input)}`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`claude ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.map((c) => c.text ?? '').join('') ?? '';
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (typeof json.summary === 'string' && typeof json.bestMove === 'string') {
      return { summary: json.summary, bestMove: json.bestMove, source: 'claude' };
    }
    throw new Error('unexpected claude payload');
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Commentary service. Spectators (or the table) buy a recap + best-move read.
 * Uses Claude when ANTHROPIC_API_KEY is set, otherwise a deterministic template.
 */
export function registerCommentaryService(app: FastifyInstance, ctx: AppContext): void {
  const apiKey = ctx.config.anthropicApiKey;
  registerPaidService<CommentaryInput, CommentaryResult>(app, ctx, {
    path: '/services/commentary/commentary',
    service: 'commentary',
    providerId: SERVICE_IDS.commentary,
    walletId: SERVICE_IDS.commentary,
    fee: SERVICE_FEES.commentary,
    description: `AI hand commentary (${apiKey ? 'Claude-backed' : 'template'})`,
    handle: async (body) => {
      let result: CommentaryResult;
      if (apiKey) {
        try {
          result = await claudeCommentary(body, apiKey);
        } catch {
          result = templateCommentary(body);
        }
      } else {
        result = templateCommentary(body);
      }
      return { result, handId: body.handId ?? null };
    },
  });
}

export { templateCommentary };
