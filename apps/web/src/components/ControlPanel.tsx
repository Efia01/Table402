import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useClientId } from '../lib/clientId';
import { archetypeColor } from '../lib/ui';

const ARCHETYPES = ['random', 'tight', 'aggro', 'budget'] as const;

export function ControlPanel() {
  const clientId = useClientId();
  const qc = useQueryClient();
  const [archetype, setArchetype] = useState<string>('random');
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['agentStatus', clientId],
    queryFn: () => api.agentStatus(clientId),
    refetchInterval: 2500,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['agentStatus', clientId] });

  const start = useMutation({
    mutationFn: () => api.startAgent(clientId, archetype),
    onSuccess: (r) => setError(r.ok ? null : (r.error ?? 'could not start')),
    onSettled: invalidate,
  });
  const stop = useMutation({
    mutationFn: () => api.stopAgent(clientId),
    onSettled: invalidate,
  });

  const mine = status.data?.mine ?? null;
  const busy = start.isPending || stop.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass flex flex-wrap items-center justify-between gap-4 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span className="label">Your agent</span>
        {mine ? (
          <span
            className="chip"
            style={{
              color: archetypeColor(mine.archetype),
              borderColor: `${archetypeColor(mine.archetype)}66`,
              background: `${archetypeColor(mine.archetype)}14`,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: archetypeColor(mine.archetype) }} />
            {mine.name}
            {mine.seatIndex != null ? ` · seat #${mine.seatIndex}` : ''}
          </span>
        ) : (
          <span className="text-sm text-mute">not seated</span>
        )}
        {status.data && (
          <span className="hidden text-[11px] text-ghost sm:inline">
            {status.data.seated} seated · {status.data.userCount} human · {status.data.botCount} bots
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!mine && (
          <div className="flex items-center gap-1">
            {ARCHETYPES.map((a) => (
              <button
                key={a}
                onClick={() => setArchetype(a)}
                className="chip transition"
                style={{
                  color: archetype === a ? archetypeColor(a) : '#9aa0b6',
                  borderColor: archetype === a ? `${archetypeColor(a)}aa` : '#272c3e',
                  background: archetype === a ? `${archetypeColor(a)}1a` : 'transparent',
                }}
              >
                {a}
              </button>
            ))}
          </div>
        )}
        {mine ? (
          <button className="btn" onClick={() => stop.mutate()} disabled={busy}>
            ■ Stop my agent
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => start.mutate()} disabled={busy}>
            {start.isPending ? 'seating…' : '▶ Start playing'}
          </button>
        )}
      </div>

      {error && <div className="w-full text-xs text-bad">{error}</div>}
      <div className="w-full text-[11px] text-ghost">
        One autonomous agent per browser. It pays its own seat fee over MPP (402), then plays on its
        own — opponents are filled in automatically.
      </div>
    </motion.div>
  );
}
