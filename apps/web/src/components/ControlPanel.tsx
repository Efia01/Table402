import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useClientId } from '../lib/clientId';

export function ControlPanel() {
  const clientId = useClientId();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [autopilot, setAutopilot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['agentStatus', clientId],
    queryFn: () => api.agentStatus(clientId),
    refetchInterval: 2500,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['agentStatus', clientId] });

  const start = useMutation({
    mutationFn: () => api.startAgent(clientId, { name: name.trim() || undefined, autopilot }),
    onMutate: () => setError(null),
    onSuccess: (r) => setError(r.ok ? null : (r.error ?? 'could not start')),
    onError: (e) => setError((e as Error).message || 'start failed'),
    onSettled: invalidate,
  });
  const stop = useMutation({
    mutationFn: () => api.stopAgent(clientId),
    onMutate: () => setError(null),
    onSuccess: (r) => setError(r.ok ? null : 'could not stop your agent'),
    onError: (e) => setError((e as Error).message || 'stop failed'),
    onSettled: invalidate,
  });
  const toggle = useMutation({
    mutationFn: (on: boolean) => api.setAutopilot(clientId, on),
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
        <span className="label">You</span>
        {mine ? (
          <span className="chip border-agent/50 bg-agent/10 text-agent">
            <span className="h-1.5 w-1.5 rounded-full bg-agent" />
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
        {mine ? (
          <>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-mute">
              <input
                type="checkbox"
                className="accent-service"
                checked={mine.autopilot}
                onChange={(e) => toggle.mutate(e.target.checked)}
              />
              autopilot
            </label>
            <button className="btn" onClick={() => stop.mutate()} disabled={busy}>
              ■ Leave table
            </button>
          </>
        ) : (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="your name (optional)"
              maxLength={24}
              className="w-40 rounded-lg border border-edge bg-ink-700/60 px-2.5 py-1.5 text-sm placeholder:text-ghost"
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-mute">
              <input
                type="checkbox"
                className="accent-service"
                checked={autopilot}
                onChange={(e) => setAutopilot(e.target.checked)}
              />
              autopilot
            </label>
            <button className="btn btn-primary" onClick={() => start.mutate()} disabled={busy}>
              {start.isPending ? 'seating…' : '▶ Sit down & play'}
            </button>
          </>
        )}
      </div>

      {error && <div className="w-full text-xs text-bad">{error}</div>}
      <div className="w-full text-[11px] text-ghost">
        One seat per browser. You pay your own seat fee over MPP (402); then it's your turn to act —
        choose <span className="text-bad">Fold</span> / <span className="text-text">Check / Call</span> /{' '}
        <span style={{ color: '#a3e635' }}>Raise</span> below. Opponents are filled in automatically.
        Toggle <span className="text-service">autopilot</span> to let your agent play itself.
      </div>
    </motion.div>
  );
}
