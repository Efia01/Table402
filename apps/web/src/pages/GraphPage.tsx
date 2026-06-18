import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { GraphEdgeDTO } from '@table402/shared';
import { api } from '../lib/api';
import { FEE_COLOR, NODE_COLOR, feeColor, formatUsd, shorten } from '../lib/ui';
import { FeeBadge, FeeLegend, Panel, StatusDot } from '../components/primitives';

const KIND_ORDER = ['seat-fee', 'hand-fee', 'action-fee', 'service-fee'];

function EntityNode({ data }: { data: { label: string; type: string; sub?: string } }) {
  const color = NODE_COLOR[data.type] ?? '#9aa0b6';
  return (
    <div
      className="rounded-xl border px-3 py-2 text-center"
      style={{ borderColor: `${color}66`, background: `${color}14`, minWidth: 150, minHeight: 64, boxShadow: `0 0 24px -10px ${color}` }}
    >
      {KIND_ORDER.map((k, i) => (
        <Handle key={`t-${k}`} id={`t-${k}`} type="target" position={Position.Left} style={{ top: 16 + i * 13, background: FEE_COLOR[k] }} />
      ))}
      {KIND_ORDER.map((k, i) => (
        <Handle key={`s-${k}`} id={`s-${k}`} type="source" position={Position.Right} style={{ top: 16 + i * 13, background: FEE_COLOR[k] }} />
      ))}
      <div className="label" style={{ color }}>
        {data.type}
      </div>
      <div className="text-sm font-semibold text-text">{data.label}</div>
      {data.sub && <div className="stat-num mt-0.5 text-[11px] text-mute">{data.sub}</div>}
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

interface GroupedEdge {
  from: string;
  to: string;
  kind: string;
  amount: number;
  count: number;
  items: GraphEdgeDTO[];
}

export function GraphPage() {
  const { id = '' } = useParams();
  const graphQ = useQuery({ queryKey: ['graph', id], queryFn: () => api.graph(id) });
  const handQ = useQuery({ queryKey: ['hand', id], queryFn: () => api.hand(id) });
  const [selected, setSelected] = useState<{ kind: 'node' | 'edge'; data: any } | null>(null);

  const graph = graphQ.data?.graph;

  const { nodes, edges, grouped } = useMemo(() => {
    if (!graph) return { nodes: [] as Node[], edges: [] as Edge[], grouped: new Map<string, GroupedEdge>() };
    const cols: Record<string, number> = { agent: 0, table: 420, service: 860 };
    const counters: Record<string, number> = { agent: 0, table: 0, service: 0 };
    const nodes: Node[] = graph.nodes.map((n) => {
      const row = counters[n.type]++;
      const s = graph.summary.byNode.find((b) => b.id === n.id);
      const sub =
        s && (s.paid || s.received)
          ? `${s.received ? `recv ${formatUsd(s.received)}` : ''}${s.received && s.paid ? ' · ' : ''}${s.paid ? `paid ${formatUsd(s.paid)}` : ''}`
          : undefined;
      return {
        id: n.id,
        type: 'entity',
        position: { x: cols[n.type] ?? 420, y: row * 150 + 20 },
        data: { label: n.label, type: n.type, sub },
      };
    });

    const grouped = new Map<string, GroupedEdge>();
    for (const e of graph.edges) {
      const key = `${e.from}|${e.to}|${e.kind}`;
      const g = grouped.get(key) ?? { from: e.from, to: e.to, kind: e.kind, amount: 0, count: 0, items: [] };
      g.amount += e.amount;
      g.count += 1;
      g.items.push(e);
      grouped.set(key, g);
    }

    const edges: Edge[] = [...grouped.entries()].map(([key, g]) => ({
      id: key,
      source: g.from,
      target: g.to,
      sourceHandle: `s-${g.kind}`,
      targetHandle: `t-${g.kind}`,
      animated: true,
      label: g.count > 1 ? `${formatUsd(g.amount)} ×${g.count}` : formatUsd(g.amount),
      labelStyle: { fill: feeColor(g.kind), fontSize: 11, fontFamily: 'ui-monospace' },
      labelBgStyle: { fill: '#0f111a', fillOpacity: 0.85 },
      labelBgPadding: [4, 2] as [number, number],
      style: { stroke: feeColor(g.kind), strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: feeColor(g.kind) },
    }));
    return { nodes, edges, grouped };
  }, [graph]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Receipt graph</h1>
            {graph && <StatusDot ok={graph.verified} />}
          </div>
          <div className="font-mono text-xs text-ghost">{id}</div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/hands/${id}`} className="btn">
            Replay hand
          </Link>
          {handQ.data?.hand && (
            <Link to={`/table/${handQ.data.hand.tableId}`} className="btn">
              Live table
            </Link>
          )}
        </div>
      </div>

      {graph && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip border-edge bg-ink-700/60 text-mute">
            total paid <span className="stat-num ml-1.5 text-text">{formatUsd(graph.summary.totalPaid)}</span>
          </span>
          <span className="chip border-edge bg-ink-700/60 text-mute">
            {graph.nodes.length} nodes · {graph.edges.length} receipts
          </span>
          <FeeLegend />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <div className="glass h-[560px] overflow-hidden p-0">
            {graph ? (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                proOptions={{ hideAttribution: true }}
                onNodeClick={(_, n) => setSelected({ kind: 'node', data: n })}
                onEdgeClick={(_, e) => setSelected({ kind: 'edge', data: grouped.get(e.id) })}
                onPaneClick={() => setSelected(null)}
                minZoom={0.4}
              >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1c2031" />
              </ReactFlow>
            ) : (
              <div className="grid h-full place-items-center text-sm text-ghost">
                {graphQ.isError ? 'No graph for this hand.' : 'Loading graph…'}
              </div>
            )}
          </div>
        </div>

        {/* Inspector */}
        <div>
          <Panel title="Inspector">
            {!selected && (
              <div className="text-sm text-mute">
                Click a <span className="text-agent">node</span> or an edge to inspect who paid whom, the amount,
                provider, receipt hash, and verification status.
              </div>
            )}
            {selected?.kind === 'node' && (
              <div className="space-y-2 text-sm">
                <div className="label" style={{ color: NODE_COLOR[selected.data.data.type] }}>
                  {selected.data.data.type}
                </div>
                <div className="text-base font-semibold">{selected.data.data.label}</div>
                <div className="font-mono text-xs text-ghost">{selected.data.id}</div>
                {selected.data.data.sub && <div className="text-mute">{selected.data.data.sub}</div>}
              </div>
            )}
            {selected?.kind === 'edge' && selected.data && (
              <div className="space-y-3 text-sm">
                <FeeBadge kind={selected.data.kind} />
                <div className="stat-num text-lg" style={{ color: feeColor(selected.data.kind) }}>
                  {formatUsd(selected.data.amount)}{' '}
                  <span className="text-xs text-mute">across {selected.data.count} receipt(s)</span>
                </div>
                <div className="space-y-1.5">
                  {selected.data.items.map((it: GraphEdgeDTO) => (
                    <div key={it.id} className="glass-soft px-2.5 py-2">
                      <div className="flex items-center justify-between">
                        <span className="stat-num text-xs">{formatUsd(it.amount)}</span>
                        <StatusDot ok={it.verified} />
                      </div>
                      {it.unlocks && <div className="mt-0.5 text-[11px] text-mute">unlocks: {it.unlocks}</div>}
                      <div className="mt-0.5 font-mono text-[10px] text-ghost">hash {shorten(it.receiptHash, 10, 8)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {handQ.data?.hand?.commentary && (
            <div className="mt-5">
              <Panel title="Commentary">
                <p className="text-sm text-text">{handQ.data.hand.commentary.summary}</p>
                <p className="mt-2 text-xs text-mute">
                  <span className="text-agent">Best move:</span> {handQ.data.hand.commentary.bestMove}
                </p>
                <div className="mt-2 text-[10px] uppercase tracking-wide text-ghost">
                  source: {handQ.data.hand.commentary.source}
                </div>
              </Panel>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
