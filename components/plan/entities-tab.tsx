"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  NodeChange,
  EdgeChange,
  NodeMouseHandler,
  Connection,
  ConnectionLineType,
  MarkerType,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { EntityNode } from "./entity-node";
import { EntityNodeData, EntityField, RFNode, RFEdge } from "@/types/plan";

const nodeTypes = { entityNode: EntityNode };

const FIELD_TYPES = [
  "UUID", "VARCHAR(255)", "VARCHAR(100)", "VARCHAR(50)", "TEXT",
  "INTEGER", "BIGINT", "BOOLEAN", "TIMESTAMP", "TIMESTAMPTZ",
  "DATE", "DECIMAL(10,2)", "FLOAT", "JSONB", "ENUM",
];

// ── Relationship configuration (per-type colors + metadata) ────────────────
interface RelConfig {
  color:       string;
  notation:    string;
  description: string;
  dash?:       string;
}

const REL_CONFIGS: Record<string, RelConfig> = {
  "has many":     { color:"#4338ca", notation:"1 : N", description:"One parent → many children"   },
  "belongs to":   { color:"#7c3aed", notation:"N : 1", description:"Many children → one parent"   },
  "has one":      { color:"#0ea5e9", notation:"1 : 1", description:"One-to-one exclusive"          },
  "many to many": { color:"#e11d48", notation:"N : M", description:"Many relate to many", dash:"6 3" },
  "references":   { color:"#059669", notation:"FK →",  description:"Foreign key reference", dash:"4 4" },
};

function relColor(label = "has many"): string {
  return REL_CONFIGS[label]?.color ?? "#6366f1";
}

function edgeStyle(label = "has many") {
  const cfg   = REL_CONFIGS[label];
  const color = cfg?.color ?? "#6366f1";
  return {
    type: "smoothstep" as const,
    label,
    markerEnd: { type: MarkerType.ArrowClosed, color, width:14, height:14 },
    style: {
      stroke: color, strokeWidth: 1.8,
      ...(cfg?.dash ? { strokeDasharray: cfg.dash } : {}),
    },
    labelStyle:         { fill: color, fontSize:10, fontWeight:700 },
    labelBgStyle:       { fill:"#ffffff", fillOpacity:0.97 },
    labelBgPadding:     [6, 4] as [number, number],
    labelBgBorderRadius: 6,
  };
}

interface DrawerState {
  nodeId:      string;
  name:        string;
  description: string;
  fields:      EntityField[];
  isNew?:      boolean;
  original:    { name:string; description:string; fields:EntityField[] };
}

interface EdgeDialogState {
  edgeId:  string;
  label:   string;
  clientX: number;
  clientY: number;
}

interface Props {
  entities: { nodes: RFNode[]; edges: RFEdge[] } | null;
  readOnly?: boolean;
}

const SHORTCUTS = [
  ["Click node",        "Open editor"],
  ["Drag handle ⊕",    "Connect entities"],
  ["Double-click edge", "Change relationship"],
  ["Delete key",        "Remove selected"],
  ["Shift + drag",      "Multi-select"],
  ["Ctrl/⌘ + Z",       "Undo (browser)"],
];

export function EntitiesTab({ entities, readOnly: _readOnly = false }: Props) {
  const [nodes,      setNodes]      = useState<Node[]>(() => (entities?.nodes ?? []) as Node[]);
  const [edges,      setEdges]      = useState<Edge[]>(() =>
    (entities?.edges ?? []).map((e) => ({
      ...e, ...edgeStyle((e as { label?: string }).label ?? "has many"),
    })) as Edge[]
  );
  const [drawer,     setDrawer]     = useState<DrawerState | null>(null);
  const [edgeDialog, setEdgeDialog] = useState<EdgeDialogState | null>(null);
  const [showHelp,   setShowHelp]   = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showHelp) return;
    function handler(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as unknown as globalThis.Node)) setShowHelp(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showHelp]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []
  );

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, id:`e-${Date.now()}`, ...edgeStyle("has many") }, eds));
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    const d    = node.data as EntityNodeData;
    const snap = { name: d.name ?? "", description: d.description ?? "", fields: d.fields ? [...d.fields] : [] };
    setDrawer({ nodeId: node.id, ...snap, original: snap });
  }, []);

  // ── Edge double-click → show floating relationship picker ─────────────────
  const onEdgeDoubleClick = useCallback((evt: React.MouseEvent, edge: Edge) => {
    setEdgeDialog({
      edgeId:  edge.id,
      label:   String(edge.label ?? "has many"),
      clientX: evt.clientX,
      clientY: evt.clientY,
    });
  }, []);

  function updateDrawer(patch: Partial<Omit<DrawerState, "nodeId" | "original" | "isNew">>) {
    if (!drawer) return;
    const next = { ...drawer, ...patch };
    setDrawer(next);
    setNodes((nds) =>
      nds.map((n) =>
        n.id === next.nodeId
          ? { ...n, data: { ...n.data, name: next.name, description: next.description, fields: next.fields } }
          : n
      )
    );
  }

  function updateField(idx: number, key: keyof EntityField, value: string | boolean) {
    if (!drawer) return;
    const fields = drawer.fields.map((f, i) => (i === idx ? { ...f, [key]: value } : f));
    updateDrawer({ fields });
  }

  function addField() {
    if (!drawer) return;
    updateDrawer({ fields: [...drawer.fields, { name:"", type:"VARCHAR(255)", isPrimary:false, isNullable:true }] });
  }

  function removeField(idx: number) {
    if (!drawer) return;
    updateDrawer({ fields: drawer.fields.filter((_, i) => i !== idx) });
  }

  function saveDrawer()  { setDrawer(null); }

  function cancelDrawer() {
    if (!drawer) return;
    if (!drawer.isNew) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === drawer.nodeId ? { ...n, data: { ...n.data, ...drawer.original } } : n
        )
      );
    } else {
      setNodes((nds) => nds.filter((n) => n.id !== drawer.nodeId));
    }
    setDrawer(null);
  }

  function deleteEntity() {
    if (!drawer) return;
    setNodes((nds) => nds.filter((n) => n.id !== drawer.nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== drawer.nodeId && e.target !== drawer.nodeId));
    setDrawer(null);
  }

  function addEntity() {
    const id = `entity-${Date.now()}`;
    const newNode: Node = {
      id,
      type: "entityNode",
      position: { x: 80 + (nodes.length % 3) * 360, y: 80 + Math.floor(nodes.length / 3) * 280 },
      data: { name:"NewEntity", description:"", fields:[{ name:"id", type:"UUID", isPrimary:true, isNullable:false }] },
    };
    setNodes((nds) => [...nds, newNode]);
    const snap = { name:"NewEntity", description:"", fields:[{ name:"id", type:"UUID", isPrimary:true, isNullable:false }] };
    setDrawer({ nodeId:id, ...snap, original:snap, isNew:true });
  }

  function saveEdgeLabel() {
    if (!edgeDialog) return;
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeDialog.edgeId
          ? { ...e, ...edgeStyle(edgeDialog.label), label: edgeDialog.label }
          : e
      )
    );
    setEdgeDialog(null);
  }

  // Calculate safe dialog position so it stays within viewport
  function dialogPos(clientX: number, clientY: number): { left: number; top: number } {
    const W = typeof window !== "undefined" ? window.innerWidth  : 1280;
    const H = typeof window !== "undefined" ? window.innerHeight : 800;
    return {
      left: Math.max(8, Math.min(clientX - 190, W - 396)),
      top:  Math.max(8, Math.min(clientY + 12,  H - 470)),
    };
  }

  const pkCount = drawer?.fields.filter((f) => f.isPrimary).length ?? 0;

  // Active relationship types present on canvas (for legend)
  const activeRelTypes = Object.keys(REL_CONFIGS).filter(
    (label) => edges.some((e) => String(e.label) === label)
  );

  return (
    <div className="relative h-full flex">

      {/* ── Canvas column ──────────────────────────────────────────────────── */}
      <div className="flex-1 h-full flex flex-col min-w-0">

        {/* Toolbar */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 border-b border-[#e2e8f0] shrink-0"
          style={{ background:"linear-gradient(to bottom, #fff 0%, #fafbfc 100%)" }}
        >
          {/* Add Entity */}
          <button
            onClick={addEntity}
            className="flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-all font-semibold shadow-sm shrink-0 hover:shadow-md active:scale-[0.97]"
            style={{ background:"linear-gradient(135deg, #4338ca, #6366f1)" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Entity
          </button>

          <div className="h-4 w-px bg-[#e2e8f0]" />

          {/* Stats */}
          <div className="flex items-center gap-2 text-[11px] text-[#64748b]">
            <div className="flex items-center gap-1 bg-[#f8fafc] border border-[#e2e8f0] px-2 py-0.5 rounded-md">
              <svg className="w-3 h-3 text-[#4338ca]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 7h16M4 12h16M4 17h10" />
              </svg>
              <span className="font-semibold text-[#0f172a]">{nodes.length}</span>
              <span>{nodes.length === 1 ? "entity" : "entities"}</span>
            </div>

            {edges.length > 0 && (
              <div className="flex items-center gap-1 bg-[#f8fafc] border border-[#e2e8f0] px-2 py-0.5 rounded-md">
                <svg className="w-3 h-3 text-[#6366f1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
                </svg>
                <span className="font-semibold text-[#0f172a]">{edges.length}</span>
                <span>{edges.length === 1 ? "relation" : "relations"}</span>
              </div>
            )}
          </div>

          {/* Help icon */}
          <div className="ml-auto relative" ref={helpRef}>
            <button
              onClick={() => setShowHelp((v) => !v)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                showHelp
                  ? "bg-[#4338ca]/10 text-[#4338ca]"
                  : "text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f1f5f9]"
              }`}
              title="Keyboard shortcuts"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {showHelp && (
              <div className="absolute right-0 top-9 bg-white border border-[#e2e8f0] rounded-xl shadow-xl p-4 w-60 z-50">
                <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-3">
                  Controls & Shortcuts
                </p>
                <div className="space-y-2.5">
                  {SHORTCUTS.map(([key, action]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <kbd className="text-[10px] bg-[#f8fafc] border border-[#e2e8f0] px-1.5 py-0.5 rounded font-mono text-[#374151] shrink-0">
                        {key}
                      </kbd>
                      <span className="text-[11px] text-[#64748b] text-right">{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative" style={{ background:"#f8fafc" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            nodeTypes={nodeTypes}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke:"#6366f1", strokeWidth:1.8, strokeDasharray:"6 4" }}
            deleteKeyCode={drawer ? null : "Delete"}
            multiSelectionKeyCode="Shift"
            snapToGrid
            snapGrid={[12, 12]}
            connectionRadius={40}
            fitView
            fitViewOptions={{ padding:0.25 }}
            proOptions={{ hideAttribution:true }}
          >
            <Background variant={BackgroundVariant.Dots} color="#dde3ed" gap={18} size={1.2} />
            <Controls
              style={{
                background:"#fff",
                border:"1px solid #e2e8f0",
                borderRadius:10,
                boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
              }}
            />
            <MiniMap
              style={{
                background:"#fff",
                border:"1px solid #e2e8f0",
                borderRadius:10,
                boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
              }}
              nodeColor={() => "#4338ca"}
              nodeStrokeColor="#fff"
              nodeStrokeWidth={2}
              maskColor="rgba(241,245,249,0.78)"
              zoomable
              pannable
            />

            {/* Empty state */}
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div className="mt-20 bg-white border border-[#e2e8f0] rounded-2xl px-8 py-7 shadow-sm text-center max-w-sm">
                  <div className="w-12 h-12 bg-[#4338ca]/8 border border-[#4338ca]/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-[#4338ca]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7h16M4 12h16M4 17h10" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[#0f172a] mb-1.5">No entities yet</p>
                  <p className="text-xs text-[#64748b] leading-relaxed">
                    Click <strong className="text-[#4338ca]">+ Add Entity</strong> to create your data model,
                    or generate a plan to auto-populate.
                  </p>
                </div>
              </Panel>
            )}

            {/* Connection hint */}
            {nodes.length > 1 && edges.length === 0 && (
              <Panel position="bottom-center">
                <div className="mb-3 bg-white border border-[#e2e8f0] rounded-xl px-4 py-2.5 shadow-sm flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#4338ca] flex items-center justify-center shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 9l3 3-3 3M6 12h10" />
                    </svg>
                  </div>
                  <p className="text-[11px] text-[#64748b]">
                    Drag from a <span className="text-[#4338ca] font-semibold">handle •</span> to define a relationship
                  </p>
                </div>
              </Panel>
            )}

            {/* Relationship legend */}
            {activeRelTypes.length > 0 && (
              <Panel position="bottom-left">
                <div
                  className="mb-3 ml-1"
                  style={{
                    background:"white",
                    border:"1px solid #e2e8f0",
                    borderRadius:10,
                    padding:"7px 12px",
                    boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
                    display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
                  }}
                >
                  {activeRelTypes.map((label) => {
                    const cfg = REL_CONFIGS[label];
                    return (
                      <div key={label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:cfg.color, flexShrink:0 }} />
                        <span style={{ fontSize:10, color:"#64748b" }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* ── Floating edge-label dialog (near cursor, no dark overlay) ─────── */}
      {edgeDialog && (() => {
        const pos     = dialogPos(edgeDialog.clientX, edgeDialog.clientY);
        const applyCfg = REL_CONFIGS[edgeDialog.label];
        const applyBg  = applyCfg?.color ?? "#4338ca";

        return (
          <>
            <style>{`
              @keyframes edgeDialogIn {
                from { opacity:0; transform: scale(0.93) translateY(-5px); }
                to   { opacity:1; transform: scale(1)    translateY(0);    }
              }
            `}</style>

            {/* Transparent click-away */}
            <div className="fixed inset-0 z-40" onClick={() => setEdgeDialog(null)} />

            {/* Floating panel */}
            <div
              style={{
                position: "fixed",
                zIndex:   50,
                left:     pos.left,
                top:      pos.top,
                width:    382,
                background:"white",
                borderRadius: 16,
                border:   "1px solid #e2e8f0",
                boxShadow:"0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)",
                overflow: "hidden",
                animation:"edgeDialogIn 0.18s cubic-bezier(0.34, 1.3, 0.64, 1)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Dialog header */}
              <div
                style={{
                  padding:"14px 16px 11px",
                  borderBottom:"1px solid #f1f5f9",
                  background:"linear-gradient(to bottom, #fafbff, white)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#0f172a]">Relationship Type</h3>
                    <p className="text-[10px] text-[#94a3b8] mt-0.5">
                      Select type or type a custom label below
                    </p>
                  </div>
                  <button
                    onClick={() => setEdgeDialog(null)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Relationship type cards */}
              <div style={{ padding:"12px 14px 8px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {Object.entries(REL_CONFIGS).map(([relLabel, cfg]) => {
                  const isActive = edgeDialog.label === relLabel;
                  return (
                    <button
                      key={relLabel}
                      onClick={() => setEdgeDialog({ ...edgeDialog, label: relLabel })}
                      style={{
                        padding:      "10px 11px",
                        borderRadius: 10,
                        border:       isActive ? `1.5px solid ${cfg.color}` : "1.5px solid #e2e8f0",
                        background:   isActive ? `${cfg.color}0d` : "white",
                        textAlign:    "left",
                        cursor:       "pointer",
                        transition:   "all 0.1s",
                        position:     "relative",
                        outline:      "none",
                      }}
                      className={!isActive ? "hover:border-[#cbd5e1] hover:bg-[#f8fafc]" : ""}
                    >
                      {/* Active checkmark */}
                      {isActive && (
                        <div style={{
                          position:"absolute", top:7, right:7,
                          width:16, height:16, borderRadius:"50%",
                          background: cfg.color,
                          display:"flex", alignItems:"center", justifyContent:"center",
                        }}>
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6.5l2.5 2.5 5.5-5.5"
                                  stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}

                      {/* Notation badge */}
                      <div style={{
                        display:"inline-flex", alignItems:"center",
                        padding:"2px 7px", borderRadius:4, marginBottom:6,
                        background: isActive ? cfg.color : "#f1f5f9",
                        color:      isActive ? "white"    : "#64748b",
                        fontSize:10, fontFamily:"monospace", fontWeight:700,
                        letterSpacing:"0.06em",
                      }}>
                        {cfg.notation}
                      </div>

                      {/* Label */}
                      <div style={{
                        fontSize:12, fontWeight:600,
                        color: isActive ? cfg.color : "#0f172a",
                        marginBottom:3,
                      }}>
                        {relLabel}
                      </div>

                      {/* Description */}
                      <div style={{ fontSize:10, color:"#94a3b8", lineHeight:1.45 }}>
                        {cfg.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom label */}
              <div style={{ padding:"4px 14px 12px" }}>
                <label style={{
                  display:"block", fontSize:9.5, color:"#94a3b8",
                  textTransform:"uppercase", letterSpacing:"0.09em", fontWeight:600, marginBottom:5,
                }}>
                  Custom label
                </label>
                <input
                  value={edgeDialog.label}
                  onChange={(e) => setEdgeDialog({ ...edgeDialog, label: e.target.value })}
                  placeholder="or type a custom label…"
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#4338ca]/50 focus:ring-2 focus:ring-[#4338ca]/10 transition-all"
                />
              </div>

              {/* Footer */}
              <div style={{
                padding:"10px 14px",
                borderTop:"1px solid #f1f5f9",
                display:"flex", gap:8,
              }}>
                <button
                  onClick={() => setEdgeDialog(null)}
                  className="flex-1 text-xs text-[#64748b] border border-[#e2e8f0] hover:border-[#cbd5e1] hover:text-[#374151] py-2 rounded-xl transition-colors bg-white"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdgeLabel}
                  className="flex-1 text-xs text-white py-2 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                  style={{ background:`linear-gradient(135deg, ${applyBg}, ${applyBg}cc)` }}
                >
                  Apply
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Entity Edit Drawer ──────────────────────────────────────────────── */}
      {drawer && (
        <div
          className="w-[300px] shrink-0 border-l border-[#e2e8f0] bg-white flex flex-col overflow-hidden"
          style={{ boxShadow:"-4px 0 20px rgba(0,0,0,0.05)" }}
        >
          {/* Drawer header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0] shrink-0"
            style={{ background:"linear-gradient(to bottom, #fafbff, white)" }}
          >
            <div>
              <h3 className="text-[13px] font-bold text-[#0f172a]">
                {drawer.isNew ? "New Entity" : "Edit Entity"}
              </h3>
              <p className="text-[10px] text-[#94a3b8] mt-0.5">
                {drawer.fields.length} field{drawer.fields.length !== 1 ? "s" : ""}
                {pkCount > 0 && <> · <span className="text-amber-600">{pkCount} PK</span></>}
              </p>
            </div>
            <button
              onClick={cancelDrawer}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Drawer body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Entity name */}
            <div>
              <label className="block text-[10px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-1.5">
                Entity Name
              </label>
              <input
                value={drawer.name}
                onChange={(e) => updateDrawer({ name: e.target.value })}
                placeholder="e.g. User, Product, Order"
                autoFocus={drawer.isNew}
                className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm text-[#0f172a] font-semibold focus:outline-none focus:border-[#4338ca]/50 focus:ring-2 focus:ring-[#4338ca]/10 transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-1.5">
                Description
              </label>
              <textarea
                value={drawer.description}
                onChange={(e) => updateDrawer({ description: e.target.value })}
                rows={2}
                placeholder="What does this entity represent?"
                className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm text-[#0f172a] resize-none focus:outline-none focus:border-[#4338ca]/50 focus:ring-2 focus:ring-[#4338ca]/10 transition-all"
              />
            </div>

            {/* Fields */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-semibold">
                  Fields
                </label>
                <button
                  onClick={addField}
                  className="text-[11px] text-[#4338ca] hover:text-[#3730a3] font-bold transition-colors flex items-center gap-0.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add field
                </button>
              </div>

              <datalist id="entity-field-types">
                {FIELD_TYPES.map((t) => <option key={t} value={t} />)}
              </datalist>

              <div className="space-y-2">
                {drawer.fields.map((field, i) => (
                  <div
                    key={i}
                    style={{
                      border:     `1px solid ${field.isPrimary ? "#FDE68A" : "#e2e8f0"}`,
                      borderRadius: 10,
                      padding:    "10px",
                      background: field.isPrimary ? "#FFFCF0" : "#FAFCFF",
                      transition: "all 0.1s",
                    }}
                  >
                    {/* Name + type inputs */}
                    <div className="flex gap-1.5 mb-2">
                      <input
                        value={field.name}
                        onChange={(e) => updateField(i, "name", e.target.value)}
                        placeholder="field_name"
                        className="flex-1 bg-white border border-[#e2e8f0] rounded-lg px-2 py-1.5 text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#4338ca]/40 font-mono min-w-0 transition-colors"
                      />
                      <input
                        value={field.type}
                        onChange={(e) => updateField(i, "type", e.target.value)}
                        list="entity-field-types"
                        placeholder="type"
                        className="w-[96px] bg-white border border-[#e2e8f0] rounded-lg px-2 py-1.5 text-[11px] text-[#64748b] font-mono placeholder-[#94a3b8] focus:outline-none focus:border-[#4338ca]/40 shrink-0 transition-colors"
                      />
                    </div>

                    {/* Toggle row: PK · null? · delete */}
                    <div className="flex items-center gap-1.5">
                      {/* PK toggle pill */}
                      <button
                        type="button"
                        onClick={() => updateField(i, "isPrimary", !field.isPrimary)}
                        style={{
                          display:"flex", alignItems:"center", gap:4,
                          padding:"3px 8px", borderRadius:20,
                          border:`1px solid ${field.isPrimary ? "#FDE68A" : "#e2e8f0"}`,
                          background: field.isPrimary ? "#FEF3C7" : "white",
                          color:      field.isPrimary ? "#92400E"  : "#94A3B8",
                          fontSize:10, fontWeight:600, cursor:"pointer",
                          transition:"all 0.1s",
                        }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                          <circle cx="8" cy="9" r="4.5" stroke="currentColor" strokeWidth="2"/>
                          <path d="M12.5 9H20M18 9V13M15.5 9V12"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        PK
                      </button>

                      {/* Nullable toggle pill */}
                      <button
                        type="button"
                        onClick={() => updateField(i, "isNullable", !field.isNullable)}
                        style={{
                          padding:"3px 8px", borderRadius:20,
                          border:`1px solid ${field.isNullable ? "#CBD5E1" : "#e2e8f0"}`,
                          background: field.isNullable ? "#F1F5F9" : "white",
                          color:      field.isNullable ? "#475569"  : "#94A3B8",
                          fontSize:10, fontWeight:500, cursor:"pointer",
                          transition:"all 0.1s",
                        }}
                      >
                        null?
                      </button>

                      {/* Delete field */}
                      <button
                        type="button"
                        onClick={() => removeField(i)}
                        title="Remove field"
                        className="ml-auto p-1 text-[#cbd5e1] hover:text-red-400 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                {drawer.fields.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-[#e2e8f0] rounded-xl">
                    <p className="text-[11px] text-[#94a3b8] mb-1">No fields yet</p>
                    <button onClick={addField} className="text-[11px] text-[#4338ca] font-semibold hover:underline">
                      + Add first field
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Drawer footer */}
          <div className="px-4 py-3 border-t border-[#e2e8f0] space-y-2 bg-[#f8fafc] shrink-0">
            <div className="flex gap-2">
              <button
                onClick={cancelDrawer}
                className="flex-1 text-xs text-[#64748b] hover:text-[#374151] border border-[#e2e8f0] hover:border-[#cbd5e1] py-2 rounded-xl transition-colors bg-white"
              >
                {drawer.isNew ? "Discard" : "Revert"}
              </button>
              <button
                onClick={saveDrawer}
                className="flex-1 text-xs text-white py-2 rounded-xl font-bold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                style={{ background:"linear-gradient(135deg, #4338ca, #6366f1)" }}
              >
                Done
              </button>
            </div>
            {!drawer.isNew && (
              <button
                onClick={deleteEntity}
                className="w-full text-xs text-red-500 hover:text-red-600 hover:bg-red-50 border border-red-100/80 hover:border-red-200 py-2 rounded-xl transition-colors"
              >
                Delete Entity
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
