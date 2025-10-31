import React, { useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Position,
  useNodesState,
  useEdgesState,
  Handle,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from "reactflow";
import type { Edge, EdgeProps, Node as RFNode, ReactFlowInstance } from "reactflow";
import "reactflow/dist/style.css";

/**
 * CLD Interactive (Hardcoded)
 * ------------------------------------------------------------
 * - Todo hardcodeado (layout + series de tiempo)
 * - Interactividad: Play/Pause, slider, velocidad
 * - Nodos arrastrables; algunos se renderizan como cilindros (tanques) con "agua"
 */

// ---------------- Types ----------------
interface NodeSnapshot { id: string; x: number; y: number; label: string }
type NodeData = { label: string; value?: number; max?: number };
interface EdgeSnapshot { id: string; source: string; target: string; polarity: "+" | "-"; delayed?: boolean }
interface TimelineFrame { date: string; nodes: NodeSnapshot[]; edges: EdgeSnapshot[] }

// Paleta estilo Wikipedia (oscuro)
const COLORS = {
  bg: "#0f1216",
  card: "#1a1e24",
  axis: "#9aa4b2",
  pos: "#47e6e6",
  neg: "#ff6262",
  nodeBlue: "#0ea5e9",
  nodeTeal: "#22d3ee",
  nodeRed: "#ef4444",
  text: "#e2e8f0",
  grid: "#2a313b",
};

// ---------------- Layout (posiciones fijas) ----------------
const L = {
  tasa_inmigrantes: { id: "tasa_inmigrantes", label: "Tasa de inmigrantes", x: 40, y: 120 },
  nuevos_inmigrantes: { id: "nuevos_inmigrantes", label: "Nuevos inmigrantes", x: 130, y: 200 },
  nuevos_desempleados: { id: "nuevos_desempleados", label: "Nuevos Inmigrantes Desempleados", x: 140, y: 260 },
  poblacion_inm: { id: "poblacion_inm", label: "Población inmigrante", x: 360, y: 110 },
  se_van: { id: "se_van", label: "Inmigrantes que se van", x: 520, y: 130 },
  tasa_emigrantes: { id: "tasa_emigrantes", label: "tasa de emigrantes", x: 560, y: 50 },

  desempleados: { id: "desempleados", label: "Inmigrantes Desempleados", x: 360, y: 360 },
  obtienen_empleo: { id: "obtienen_empleo", label: "Inmigrantes que obtienen empleo", x: 550, y: 390 },
  tasa_empleo: { id: "tasa_empleo", label: "tasa de inmigrantes con empleo", x: 620, y: 470 },
  tasa_desem: { id: "tasa_desem", label: "tasa de desempleo", x: 40, y: 420 },

  nuevos_delinc: { id: "nuevos_delinc", label: "Nuevos Delincuentes", x: 700, y: 250 },
  delinc_calle: { id: "delinc_calle", label: "Delincuentes en la calle", x: 860, y: 210 },
  arrestados: { id: "arrestados", label: "Delincuentes arrestados", x: 1040, y: 200 },
  muertos: { id: "muertos", label: "Delincuentes muertos", x: 900, y: 60 },
  tasa_muertes: { id: "tasa_muertes", label: "tasa de muertes", x: 940, y: 10 },
  tasa_arrestos: { id: "tasa_arrestos", label: "tasa de arrestos", x: 1100, y: 120 },

  fondos: { id: "fondos", label: "Fondos municipales", x: 900, y: 320 },
  programas: { id: "programas", label: "Programas de integración", x: 740, y: 360 },

  policias_serv: { id: "policias_serv", label: "Policías en Servicio", x: 1040, y: 420 },
  delitos_res: { id: "delitos_res", label: "Delitos resueltos", x: 980, y: 330 },
  policias_asig: { id: "policias_asig", label: "Policías asignados", x: 900, y: 470 },
  tasa_contrat: { id: "tasa_contrat", label: "tasa policías contratados", x: 820, y: 520 },
  discrepancia: { id: "discrepancia", label: "Discrepancia", x: 1150, y: 470 },
  objetivo: { id: "objetivo", label: "Objetivo", x: 1220, y: 520 },
  policias_ret: { id: "policias_ret", label: "Policías retirados", x: 1220, y: 420 },
  tasa_ret: { id: "tasa_ret", label: "tasa de policías retirados", x: 1320, y: 360 },
};

const BASE_NODES: NodeSnapshot[] = Object.values(L);
const CYLINDER_IDS = new Set(["poblacion_inm", "desempleados", "delinc_calle", "policias_serv"]);
const MAX_HINT: Record<string, number> = { poblacion_inm: 12000, desempleados: 1500, delinc_calle: 300, policias_serv: 1400 };

// ---------------- Enlaces (+/−) ----------------
const BASE_EDGES: EdgeSnapshot[] = [
  { id: "e1", source: L.tasa_inmigrantes.id, target: L.nuevos_inmigrantes.id, polarity: "+" },
  { id: "e2", source: L.nuevos_inmigrantes.id, target: L.poblacion_inm.id, polarity: "+" },
  { id: "e3", source: L.poblacion_inm.id, target: L.se_van.id, polarity: "+" },
  { id: "e4", source: L.tasa_emigrantes.id, target: L.se_van.id, polarity: "+" },
  { id: "e5", source: L.se_van.id, target: L.poblacion_inm.id, polarity: "-" },

  { id: "e6", source: L.nuevos_inmigrantes.id, target: L.nuevos_desempleados.id, polarity: "+" },
  { id: "e7", source: L.nuevos_desempleados.id, target: L.desempleados.id, polarity: "+" },
  { id: "e8", source: L.desempleados.id, target: L.obtienen_empleo.id, polarity: "-" },
  { id: "e9", source: L.tasa_empleo.id, target: L.obtienen_empleo.id, polarity: "+" },
  { id: "e10", source: L.obtienen_empleo.id, target: L.desempleados.id, polarity: "-" },
  { id: "e11", source: L.tasa_desem.id, target: L.nuevos_desempleados.id, polarity: "+" },

  { id: "e12", source: L.desempleados.id, target: L.nuevos_delinc.id, polarity: "+" },
  { id: "e13", source: L.nuevos_delinc.id, target: L.delinc_calle.id, polarity: "+" },
  { id: "e14", source: L.delinc_calle.id, target: L.muertos.id, polarity: "+" },
  { id: "e15", source: L.tasa_muertes.id, target: L.muertos.id, polarity: "+" },
  { id: "e16", source: L.muertos.id, target: L.delinc_calle.id, polarity: "-" },
  { id: "e17", source: L.tasa_arrestos.id, target: L.arrestados.id, polarity: "+" },
  { id: "e18", source: L.delinc_calle.id, target: L.arrestados.id, polarity: "+" },
  { id: "e19", source: L.arrestados.id, target: L.delinc_calle.id, polarity: "-" },

  { id: "e20", source: L.delinc_calle.id, target: L.fondos.id, polarity: "+" },
  { id: "e21", source: L.fondos.id, target: L.programas.id, polarity: "+" },
  { id: "e22", source: L.programas.id, target: L.obtienen_empleo.id, polarity: "+" },
  { id: "e33", source: L.fondos.id, target: L.tasa_contrat.id, polarity: "+" }, // fondos → tasa policías contratados

  { id: "e23", source: L.tasa_contrat.id, target: L.policias_asig.id, polarity: "+" },
  { id: "e24", source: L.policias_asig.id, target: L.policias_serv.id, polarity: "+" },
  { id: "e25", source: L.policias_serv.id, target: L.delitos_res.id, polarity: "+" },
  { id: "e26", source: L.delitos_res.id, target: L.delinc_calle.id, polarity: "-" },
  { id: "e27", source: L.policias_serv.id, target: L.discrepancia.id, polarity: "-" },
  { id: "e28", source: L.objetivo.id, target: L.discrepancia.id, polarity: "+" },
  { id: "e29", source: L.discrepancia.id, target: L.tasa_contrat.id, polarity: "+" },
  { id: "e30", source: L.policias_serv.id, target: L.policias_ret.id, polarity: "+" },
  { id: "e31", source: L.tasa_ret.id, target: L.policias_ret.id, polarity: "+" },
  { id: "e32", source: L.policias_ret.id, target: L.policias_serv.id, polarity: "-" },
];

// ---------------- Serie temporal hardcoded ----------------
const SERIES: Array<{ date: string; v: Record<string, number> }> = [
  { date: "2025-01-01", v: { poblacion_inm: 10000, desempleados: 1200, delinc_calle: 240, policias_serv: 1200 } },
  { date: "2025-02-01", v: { poblacion_inm: 10150, desempleados: 1215, delinc_calle: 238, policias_serv: 1210 } },
  { date: "2025-03-01", v: { poblacion_inm: 10340, desempleados: 1210, delinc_calle: 236, policias_serv: 1220 } },
  { date: "2025-04-01", v: { poblacion_inm: 10520, desempleados: 1205, delinc_calle: 232, policias_serv: 1235 } },
  { date: "2025-05-01", v: { poblacion_inm: 10610, desempleados: 1190, delinc_calle: 229, policias_serv: 1240 } },
  { date: "2025-06-01", v: { poblacion_inm: 10700, desempleados: 1172, delinc_calle: 226, policias_serv: 1255 } },
  { date: "2025-07-01", v: { poblacion_inm: 10810, desempleados: 1160, delinc_calle: 222, policias_serv: 1265 } },
  { date: "2025-08-01", v: { poblacion_inm: 10920, desempleados: 1148, delinc_calle: 219, policias_serv: 1278 } },
  { date: "2025-09-01", v: { poblacion_inm: 11010, desempleados: 1136, delinc_calle: 216, policias_serv: 1285 } },
  { date: "2025-10-01", v: { poblacion_inm: 11100, desempleados: 1120, delinc_calle: 213, policias_serv: 1290 } },
];

const withValueLabel = (base: NodeSnapshot, val?: number): NodeSnapshot => ({
  ...base,
  label: val == null ? base.label : `${base.label.split(" (")[0]} (${val.toLocaleString("es-PE")})`,
});

const HARD_FRAMES: TimelineFrame[] = SERIES.map(({ date, v }) => ({
  date,
  nodes: BASE_NODES.map((n) => withValueLabel(n, v[n.id as keyof typeof v] as number | undefined)),
  edges: BASE_EDGES,
}));

// Precompute min/max por variable para normalización visible (cilindros)
const SERIES_MIN: Record<string, number> = {};
const SERIES_MAX: Record<string, number> = {};
for (const s of SERIES) {
  for (const k in s.v) {
    SERIES_MIN[k] = Math.min(SERIES_MIN[k] ?? +Infinity, s.v[k]);
    SERIES_MAX[k] = Math.max(SERIES_MAX[k] ?? -Infinity, s.v[k]);
  }
}

// ---------------- Tests (no modificar los existentes) + extra ----------------
function tExpect(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }
if (typeof window !== "undefined" && (window as unknown as { __RUN_CLD_TESTS__?: boolean })?.__RUN_CLD_TESTS__) {
  tExpect(HARD_FRAMES.length === SERIES.length, "frames != series length");
  tExpect(HARD_FRAMES[0].nodes.length === BASE_NODES.length, "nodes length mismatch");
  // Extra: asegurar que los cilindros existen en el layout
  for (const id of Array.from(CYLINDER_IDS)) {
    tExpect(!!BASE_NODES.find(n => n.id === id), `cylinder node missing: ${id}`);
  }
  // Extra: hooks disponibles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tExpect(typeof (useNodesState as any) === 'function', 'useNodesState missing');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tExpect(typeof (useEdgesState as any) === 'function', 'useEdgesState missing');
  console.log("CLD hardcoded tests OK");
}

// ================== Circular Edge (curva estilo bucle) ==================
function CircularEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    style,
    label,
  } = props;
  // mayor curvature para hacerla más "circular"
  const CURVATURE = 0.85;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: CURVATURE,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: '#1a1e24',
              color: '#e2e8f0',
              padding: '2px 6px',
              borderRadius: 6,
              fontSize: 12,
              border: '1px solid #2a313b',
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// Definir tipos de arista/nodo y opciones por defecto FUERA del componente
const EDGE_TYPES = { circular: CircularEdge } as const;
const NODE_TYPES = { tank: TankNode } as const;
const DEFAULT_EDGE_OPTIONS = { type: 'circular', style: { strokeWidth: 1.8 }, markerEnd: { type: MarkerType.ArrowClosed } } as const;

// ==========================================================
// Componente interactivo (Play / Pause / Slider / Velocidad)
// ==========================================================
export default function CLDInteractiveHardcoded() {
  const reactFlowRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const frames = HARD_FRAMES;

  const [nodes, setNodes, onNodesChange] = useNodesState([] as RFNode<NodeData>[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [selectedVarId, setSelectedVarId] = useState<string | null>(null);

  const toggleFullscreen = async () => {
    const el = wrapperRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // noop
    }
  };

  // init first frame
  useEffect(() => {
    const f = frames[0];
    const scale = 1.2; // separar un poco los nodos
    setNodes(f.nodes.map((n) => ({
      id: n.id,
      position: { x: n.x * scale, y: n.y * scale },
      data: { label: n.label, value: undefined, max: MAX_HINT[n.id] } as NodeData,
      type: CYLINDER_IDS.has(n.id) ? "tank" : "default",
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: CYLINDER_IDS.has(n.id)
        ? undefined
        : { padding: 10, borderRadius: 8, border: "1px solid #2a313b", background: COLORS.card, color: COLORS.text, fontSize: 12, boxShadow: "0 1px 2px rgba(0,0,0,.35)" },
    })));
    setEdges(f.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: e.polarity === "+" ? COLORS.pos : COLORS.neg, strokeWidth: 2 },
      label: e.delayed ? `${e.polarity} ||` : e.polarity,
      labelBgStyle: { fill: COLORS.card, fillOpacity: 0.9, stroke: COLORS.grid },
      labelStyle: { fill: COLORS.text, fontSize: 12 },
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fit una vez al iniciar
  const didFitRef = useRef(false);
  useEffect(() => {
    if (rf && nodes.length && !didFitRef.current) {
      rf.fitView({ padding: 0.2 });
      didFitRef.current = true;
    }
  }, [rf, nodes]);

  // autoplay con velocidad
  useEffect(() => {
    if (!playing) return;
    let raf = 0; let last = performance.now();
    const BASE_MS = 1000;
    const tick = (now: number) => {
      const step = BASE_MS / Math.max(0.25, Math.min(4, speed));
      if (now - last >= step) {
        last = now;
        setFrameIdx((i) => (i + 1) % frames.length);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, frames.length]);

  // actualizar labels y altura de tanques por frame
  useEffect(() => {
    const f = frames[frameIdx];
    setNodes((prev: RFNode<NodeData>[]) => prev.map((n: RFNode<NodeData>) => {
      const snap = f.nodes.find((s) => s.id === n.id)!;
      const rawValue = SERIES[frameIdx].v[n.id];
      let nextData: NodeData = { label: snap.label };
      if (CYLINDER_IDS.has(n.id)) {
        const min = SERIES_MIN[n.id] ?? 0;
        const max = SERIES_MAX[n.id] ?? 1;
        const denom = Math.max(1e-6, max - min);
        const norm = Math.max(0, Math.min(1, ((rawValue ?? min) - min) / denom));
        nextData = { label: snap.label, value: norm, max: 1 };
      }
      return { ...n, data: nextData };
    }));

    const pulse = 2 + 0.6 * Math.sin((frameIdx % 10) / 10 * Math.PI * 2);
    setEdges((prev: Edge[]) => prev.map((e: Edge) => ({
      ...e,
      style: { ...e.style, strokeWidth: pulse },
    })));
  }, [frameIdx, frames, setNodes, setEdges]);

  const onScrub = (idx: number) => setFrameIdx(idx);
  const onNodeClick = (_: React.MouseEvent, node: RFNode<NodeData>) => {
    if (CYLINDER_IDS.has(node.id)) {
      setSelectedVarId(node.id);
    }
  };

  return (
    <div ref={wrapperRef} style={{ width: "100%", height: "100vh", display: "grid", gridTemplateRows: "auto auto 200px 1fr", gap: 8, background: COLORS.bg }}>
      {/* Control bar */}
      <div style={{ display: "flex", width: "100%", maxWidth: "100vh", margin: "0 auto", alignItems: "center", gap: 12, padding: "8px 10px", background: COLORS.card, border: `1px solid ${COLORS.grid}`, borderRadius: 10, color: COLORS.text }}>
        <button onClick={() => setPlaying((p) => !p)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", cursor: "pointer" }}>
          {playing ? "⏸ Pausar" : "▶️ Reproducir"}
        </button>
        <button onClick={toggleFullscreen} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", cursor: "pointer" }}>
          ⛶ Pantalla completa
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Velocidad</label>
          <select value={String(speed)} onChange={(e) => setSpeed(Number(e.target.value))} style={{ padding: 4, borderRadius: 6, border: "1px solid #334155", background: COLORS.card, color: COLORS.text }}>
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </div>
        <div style={{ fontSize: 12, color: COLORS.text, marginLeft: "auto" }}>Fecha: <b>{frames[frameIdx].date}</b></div>
      </div>

      {/* Timeline slider */}
      <div style={{ padding: "0 10px", width: "100%", maxWidth: "100vh", margin: "0 auto" }}>
        <input type="range" min={0} max={frames.length - 1} step={1} value={frameIdx} onChange={(e) => onScrub(Number(e.target.value))} style={{ width: "100%" }} />
      </div>

      {/* Mini chart sincronizado con selección de tanque */}
      <MiniChart frameIdx={frameIdx} series={SERIES} selectedVarId={selectedVarId} />

      {/* Diagram */}
      <div style={{ width: "100%", height: "100%", border: `1px solid ${COLORS.grid}`, borderRadius: 12, overflow: "hidden", background: COLORS.card }}>
        <ReactFlow
          ref={reactFlowRef}
          onInit={(inst: ReactFlowInstance) => { setRf(inst); requestAnimationFrame(() => inst.fitView({ padding: 0.2 })); }}
          fitViewOptions={{ padding: 0.2, includeHiddenNodes: true }}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onEdgesChange={onEdgesChange}
          fitView
          panOnDrag={true}
          selectionOnDrag={true}
          elementsSelectable={true}
          nodesDraggable={true}
          edgesFocusable={true}
          zoomOnScroll={true}
          panOnScroll={true}
          panOnScrollSpeed={0.8}
          
          zoomOnPinch={true}
          zoomOnDoubleClick={true}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          edgeTypes={EDGE_TYPES}
          nodeTypes={NODE_TYPES}
        >
          <Background gap={18} size={1} color={COLORS.grid} />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

// ================== MiniChart Component (hardcoded, like Wikipedia curves) ==================
function MiniChart({ frameIdx, series, selectedVarId }: { frameIdx: number; series: Array<{ date: string; v: Record<string, number> }>; selectedVarId: string | null }) {
  const VAR_META: Record<string, { name: string; color: string }> = {
    poblacion_inm: { name: "Población inmigrante", color: COLORS.nodeBlue },
    desempleados: { name: "Inmigrantes Desempleados", color: COLORS.nodeRed },
    delinc_calle: { name: "Delincuentes en la calle", color: COLORS.nodeTeal },
    policias_serv: { name: "Policías en Servicio", color: COLORS.nodeBlue },
  };
  const w = 900, h = 180, pad = 40;
  const xMin = 0, xMax = series.length - 1;
  const X = (i: number) => pad + (i - xMin) / (xMax - xMin || 1) * (w - pad * 2);

  return (
    <div style={{ padding: "6px 10px", width: "100%", maxWidth: "100vh", margin: "0 auto" }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: COLORS.card, border: `1px solid ${COLORS.grid}`, borderRadius: 10 }}>
        {/* axes */}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke={COLORS.axis} strokeWidth={1} />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke={COLORS.axis} strokeWidth={1} />
        {/* contenido según selección */}
        {selectedVarId ? (
          (() => {
            const ys = series.map(s => s.v[selectedVarId] ?? 0);
            const yMin = Math.min(...ys);
            const yMax = Math.max(...ys);
            const Y = (y: number) => h - pad - (y - yMin) / (yMax - yMin || 1) * (h - pad * 2);
            const color = VAR_META[selectedVarId]?.color ?? COLORS.nodeTeal;
            const name = VAR_META[selectedVarId]?.name ?? selectedVarId;
            const pathFull = series.map((s, i) => `${i === 0 ? "M" : "L"} ${X(i)},${Y(s.v[selectedVarId] ?? 0)}`).join(" ");
            const pathProg = series.slice(0, Math.max(1, frameIdx + 1)).map((s, i) => `${i === 0 ? "M" : "L"} ${X(i)},${Y(s.v[selectedVarId] ?? 0)}`).join(" ");
            return (
              <g>
                {/* grid vertical */}
                {series.map((_, i) => <line key={i} x1={X(i)} y1={pad} x2={X(i)} y2={h - pad} stroke={COLORS.grid} strokeWidth={0.5} />)}
                {/* línea tenue completa (referencia) */}
                <path d={pathFull} fill="none" stroke={COLORS.axis} strokeOpacity={0.25} strokeWidth={2} />
                {/* línea progresiva hasta frame actual */}
                <path d={pathProg} fill="none" stroke={color} strokeWidth={2.5} />
                <circle cx={X(frameIdx)} cy={Y(series[frameIdx].v[selectedVarId] ?? 0)} r={5} fill={COLORS.pos} />
                {/* leyenda */}
                <g transform={`translate(${w - pad - 260}, ${pad})`}>
                  <rect width="12" height="12" fill={color} />
                  <text x="18" y="10" fill={COLORS.text} fontSize="12">{name}</text>
                </g>
              </g>
            );
          })()
        ) : (
          <text x={pad + 8} y={pad + 12} fill={COLORS.axis} fontSize="12">Selecciona un tanque para ver su serie temporal…</text>
        )}
      </svg>
    </div>
  );
}

// ================== TankNode (cilindro con agua animada) ==================
function TankNode({ data }: { data: { label: string; value?: number; max?: number } }) {
  const w = 120, h = 80; // tamaño del cilindro
  const level = (() => {
    const v = data?.value ?? 0; const m = data?.max || 1; const r = Math.max(0, Math.min(1, v / m));
    return r; // 0..1
  })();
  const waveId = React.useId();
  const clipId = React.useId();
  const waterHeight = 50; // alto útil dentro del tanque
  const yTop = 16; // borde superior
  const yLevel = yTop + (1 - level) * waterHeight;

  return (
    <div style={{ color: COLORS.text, fontSize: 12, position: 'relative' }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", filter: "drop-shadow(0 2px 2px rgba(0,0,0,.35))" }}>
        {/* cuerpo cilindro */}
        <defs>
          <linearGradient id={waveId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.9" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x="20" y={yTop} width="80" height={waterHeight} rx="20" ry="20" />
          </clipPath>
        </defs>
        {/* borde cilindro */}
        <ellipse cx="60" cy={yTop} rx="40" ry="10" fill={COLORS.card} stroke={COLORS.grid} strokeWidth="2" />
        <rect x="20" y={yTop} width="80" height={waterHeight} fill={COLORS.card} stroke={COLORS.grid} strokeWidth="2" />
        <ellipse cx="60" cy={yTop + waterHeight} rx="40" ry="10" fill={COLORS.card} stroke={COLORS.grid} strokeWidth="2" />

        {/* agua */}
        <g clipPath={`url(#${clipId})`}>
          <rect x="20" y={yLevel} width="80" height={yTop + waterHeight - yLevel} fill={`url(#${waveId})`} />
          {/* ola animada */}
          <path
            d={`M20 ${yLevel + 5} C40 ${yLevel - 5}, 60 ${yLevel + 5}, 80 ${yLevel - 5} S120 ${yLevel + 5}, 140 ${yLevel - 5}`}
            fill="none"
            stroke="#9be7ff"
            strokeWidth="2"
          >
            <animate
              attributeName="d"
              dur="2s"
              repeatCount="indefinite"
              values={`M20 ${yLevel + 5} C40 ${yLevel - 5}, 60 ${yLevel + 5}, 80 ${yLevel - 5} S120 ${yLevel + 5}, 140 ${yLevel - 5};
                      M20 ${yLevel + 5} C40 ${yLevel + 5}, 60 ${yLevel - 5}, 80 ${yLevel + 5} S120 ${yLevel - 5}, 140 ${yLevel + 5};
                      M20 ${yLevel + 5} C40 ${yLevel - 5}, 60 ${yLevel + 5}, 80 ${yLevel - 5} S120 ${yLevel + 5}, 140 ${yLevel - 5}`}
            />
          </path>
        </g>
      </svg>
      <div style={{ textAlign: "center", marginTop: 4 }}>{data?.label}</div>

      {/* Handles para que los tanques estén conectados a las aristas */}
      <Handle type="target" position={Position.Left} style={{ width: 10, height: 10, background: 'transparent', border: '2px solid #64748b' }} />
      <Handle type="source" position={Position.Right} style={{ width: 10, height: 10, background: 'transparent', border: '2px solid #64748b' }} />
    </div>
  );
}
