import { useMemo } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import type { GraphEdgeDTO } from '@table402/shared';
import { api } from '../lib/api';
import { FEE_COLOR, NODE_COLOR, feeColor, formatUsd } from '../lib/ui';
import { FeeLegend } from './primitives';

const KIND_ORDER = ['seat-fee', 'hand-fee', 'action-fee', 'service-fee'];

function EntityNode({ data }: { data: { label: string; type: string; sub?: string } }) {
  const color = NODE_COLOR[data.type] ?? '#b3a99c';
  return (
    <div
      className="rounded-[6px] border px-3 py-2 text-center"
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
      <div className="text-sm font-semibold text-bone">{data.label}</div>
      {data.sub && <div className="stat-num mt-0.5 text-[11px] text-bone-dim">{data.sub}</div>}
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

/** The per-hand receipt graph: who paid whom, for what, and what it unlocked. */
export function ReceiptGraph({ handId }: { handId: string }) {
  const graphQ = useQuery({ queryKey: ['graph', handId], queryFn: () => api.graph(handId) });
  const graph = graphQ.data?.graph;

  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [] as Node[], edges: [] as Edge[] };
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
      labelBgStyle: { fill: '#0e0809', fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
      style: { stroke: feeColor(g.kind), strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: feeColor(g.kind) },
    }));
    return { nodes, edges };
  }, [graph]);

  return (
    <div className="space-y-3">
      {graph && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip border-hairline bg-noir-700/60 text-bone-dim">
            total paid <span className="stat-num ml-1.5 text-bone">{formatUsd(graph.summary.totalPaid)}</span>
          </span>
          <span className="chip border-hairline bg-noir-700/60 text-bone-dim">
            {graph.nodes.length} nodes · {graph.edges.length} receipts
          </span>
          <FeeLegend />
        </div>
      )}

      <div className="glass h-[520px] overflow-hidden p-0">
        {graph ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.4}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#241a1d" />
          </ReactFlow>
        ) : (
          <div className="grid h-full place-items-center text-sm text-bone-faint">
            {graphQ.isError ? 'No graph for this hand.' : 'Loading graph…'}
          </div>
        )}
      </div>
    </div>
  );
}
