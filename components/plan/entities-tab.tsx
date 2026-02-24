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
  Panel,
  ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { EntityNode } from "./entity-node";
import { ERDEdge } from "./ERDEdge";
import { EntityNodeData, EntityField, RFNode, RFEdge } from "@/types/plan";
import { autoLayoutEntities } from "@/lib/erd-layout";

const nodeTypes = { entityNode: EntityNode };
const edgeTypes = { erdEdge: ERDEdge };

const FIELD_TYPES = [
  "UUID",
  "SERIAL",
  "BIGSERIAL",
  "INTEGER",
  "BIGINT",
  "DECIMAL(10,2)",
  "VARCHAR(255)",
  "TEXT",
  "BOOLEAN",
  "DATE",
  "TIME",
  "TIMESTAMP",
  "TIMESTAMPTZ",
  "JSONB",
  "ENUM",
];

// ── Relationship configuration ─────────────────────────────────────────────
const NOTATION: Record<string, string> = {
  "has many":     "1:N",
  "belongs to":   "N:1",
  "has one":      "1:1",
  "many to many": "N:M",
  "references":   "FK",
};

// Map legacy notation strings back to canonical relationship type names
const NOTATION_TO_REL: Record<string, string> = {
  "1:N":  "has many",
  "N:1":  "belongs to",
  "1:1":  "has one",
  "N:M":  "many to many",
  "n:m":  "many to many",
  "FK":   "references",
  "FK →": "references",
  "FK→":  "references",
};

interface RelConfig {
  color:       string;
  notation:    string;
  description: string;
}

const REL_CONFIGS: Record<string, RelConfig> = {
  "has many":     { color:"#4338ca", notation:"1 : N", description:"One parent → many children"  },
  "belongs to":   { color:"#7c3aed", notation:"N : 1", description:"Many children → one parent"  },
  "has one":      { color:"#0ea5e9", notation:"1 : 1", description:"One-to-one exclusive"         },
  "many to many": { color:"#e11d48", notation:"N : M", description:"Many relate to many"          },
  "references":   { color:"#059669", notation:"FK →",  description:"Foreign key reference"        },
};

function edgeStyle(relLabel = "has many") {
  // Normalize legacy notation first
  const canonical = NOTATION_TO_REL[relLabel] ?? relLabel;
  return {
    type: "erdEdge" as const,
    data: {
      relationshipType: canonical,
      label:            canonical,
      notation:         NOTATION[canonical] ?? canonical,
    },
  };
}

function normalizeTypeValue(value: string): string {
  return value.trim().toUpperCase();
}

function hasPredefinedType(value: string): boolean {
  const current = normalizeTypeValue(value);
  return FIELD_TYPES.some((t) => normalizeTypeValue(t) === current);
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function singularize(value: string): string {
  if (value.endsWith("ies")) return value.slice(0, -3) + "y";
  if (value.endsWith("s") && !value.endsWith("ss")) return value.slice(0, -1);
  return value;
}

function getRelationshipType(edge: Edge): string {
  const relType =
    (edge.data as { relationshipType?: string } | undefined)?.relationshipType ??
    String(edge.label ?? "has many");
  return NOTATION_TO_REL[relType] ?? relType;
}

function findParentNodeIdForField(
  nodes: Node[],
  childNodeId: string,
  fieldName: string
): string | null {
  const fkBase = fieldName.replace(/_?id$/i, "").trim();
  if (!fkBase || fkBase.toLowerCase() === "id") return null;
  const normalizedFk = normalizeToken(fkBase);
  if (!normalizedFk) return null;

  const candidates = new Set([normalizedFk, singularize(normalizedFk)]);
  for (const node of nodes) {
    if (node.id === childNodeId) continue;
    const name = normalizeToken(((node.data as EntityNodeData)?.name ?? "").trim());
    if (!name) continue;
    if (candidates.has(name) || candidates.has(singularize(name))) {
      return node.id;
    }
  }
  return null;
}

function addMissingFkEdges(nodes: Node[], edges: Edge[]): { edges: Edge[]; added: number } {
  const existingPairs = new Set(edges.map((e) => `${e.source}->${e.target}`));
  const extraEdges: Edge[] = [];
  let seq = 0;

  for (const node of nodes) {
    const data = node.data as EntityNodeData;
    const fields = data.fields ?? [];
    for (const field of fields) {
      if (!/_?id$/i.test(field.name) || /^id$/i.test(field.name)) continue;
      const parentId = findParentNodeIdForField(nodes, node.id, field.name);
      if (!parentId) continue;
      const pair = `${parentId}->${node.id}`;
      if (existingPairs.has(pair)) continue;

      existingPairs.add(pair);
      extraEdges.push({
        id: `fk-${Date.now()}-${seq++}`,
        source: parentId,
        target: node.id,
        ...edgeStyle("has many"),
      });
    }
  }

  if (extraEdges.length === 0) return { edges, added: 0 };
  return { edges: [...edges, ...extraEdges], added: extraEdges.length };
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
  planId?: string;
  onUpdate?: (entities: { nodes: RFNode[]; edges: RFEdge[] }) => void;
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

// ── Entity List Card (used in "Entities" view) ─────────────────────────────
function EntityListCard({
  node,
  readOnly = false,
  onUpdateName,
  onUpdateDesc,
  onUpdateField,
  onAddField,
  onRemoveField,
  onDelete,
}: {
  node:           Node;
  readOnly?:      boolean;
  onUpdateName:   (nodeId: string, name: string) => void;
  onUpdateDesc:   (nodeId: string, desc: string) => void;
  onUpdateField:  (nodeId: string, idx: number, key: keyof EntityField, val: string | boolean) => void;
  onAddField:     (nodeId: string) => void;
  onRemoveField:  (nodeId: string, idx: number) => void;
  onDelete:       (nodeId: string) => void;
}) {
  const data = node.data as EntityNodeData;

  return (
    <div
      className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm hover:border-[#c7d2fe] transition-colors"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04)" }}
    >
      {/* Card header */}
      <div
        className="px-4 pt-3.5 pb-2.5 border-b border-[#f1f5f9]"
        style={{ background: "linear-gradient(to bottom, #fafbff, white)" }}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <input
              value={data.name ?? ""}
              readOnly={readOnly}
              onChange={(e) => onUpdateName(node.id, e.target.value)}
              className="w-full text-[13px] font-bold text-[#0f172a] bg-transparent outline-none border-b border-transparent hover:border-[#e2e8f0] focus:border-[#4338ca]/50 transition-colors pb-px"
              placeholder="EntityName"
            />
            <input
              value={data.description ?? ""}
              readOnly={readOnly}
              onChange={(e) => onUpdateDesc(node.id, e.target.value)}
              className="w-full text-[11px] text-[#94a3b8] bg-transparent outline-none mt-0.5 border-b border-transparent hover:border-[#e2e8f0] focus:border-[#4338ca]/30 transition-colors pb-px"
              placeholder="Describe this entity…"
            />
          </div>
          {!readOnly && (
            <button
              onClick={() => onDelete(node.id)}
              className="w-6 h-6 flex items-center justify-center rounded-md text-[#cbd5e1] hover:text-red-400 hover:bg-red-50 transition-colors shrink-0 mt-0.5"
              title="Delete entity"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="px-3 py-2">
        {/* Field header row */}
        {data.fields?.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 mb-1">
            <div className="w-1.5 shrink-0" />
            <span className="flex-1 text-[9px] font-semibold text-[#cbd5e1] uppercase tracking-wider">Name</span>
            <span className="w-[90px] text-[9px] font-semibold text-[#cbd5e1] uppercase tracking-wider text-right">Type</span>
            <span className="w-[22px] shrink-0" />
            <span className="w-4 shrink-0" />
          </div>
        )}

        {/* Field rows */}
        {(data.fields ?? []).map((field, i) => (
          <div
            key={i}
            className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors
              ${field.isPrimary ? "bg-[#fffcf0]" : "hover:bg-[#f8fafc]"}`}
          >
            {/* PK indicator dot */}
            <div className={`w-1.5 h-1.5 rounded-full shrink-0
              ${field.isPrimary ? "bg-amber-400" : "bg-[#e2e8f0]"}`}
            />

            {/* Field name */}
            <input
              value={field.name}
              readOnly={readOnly}
              onChange={(e) => onUpdateField(node.id, i, "name", e.target.value)}
              placeholder="field_name"
              className="flex-1 min-w-0 text-[11px] font-mono text-[#0f172a] bg-transparent outline-none placeholder-[#cbd5e1]"
            />

            {/* Field type */}
            <select
              value={field.type}
              disabled={readOnly}
              onChange={(e) => onUpdateField(node.id, i, "type", e.target.value)}
              className="w-[110px] text-[10px] font-mono text-[#64748b] bg-transparent outline-none text-right shrink-0 disabled:opacity-100"
            >
              {!hasPredefinedType(field.type) && (
                <option value={field.type}>{field.type}</option>
              )}
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* PK badge toggle */}
            {!readOnly && (
              <button
                onClick={() => onUpdateField(node.id, i, "isPrimary", !field.isPrimary)}
                title="Toggle primary key"
                className={`shrink-0 text-[8px] font-bold px-1.5 py-px rounded border transition-all w-[22px] text-center
                  ${field.isPrimary
                    ? "text-amber-700 bg-amber-50 border-amber-200"
                    : "text-[#e2e8f0] bg-transparent border-transparent hover:border-[#e2e8f0] hover:text-[#94a3b8]"}`}
              >
                PK
              </button>
            )}

            {/* Delete button (on hover) */}
            {!readOnly && (
              <button
                onClick={() => onRemoveField(node.id, i)}
                className="opacity-0 group-hover:opacity-100 shrink-0 w-4 h-4 flex items-center justify-center rounded text-[#cbd5e1] hover:text-red-400 transition-all"
                title="Remove field"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {/* Add field */}
        {!readOnly && (
          <button
            onClick={() => onAddField(node.id)}
            className="mt-1.5 w-full py-1.5 text-[11px] text-[#4338ca] hover:text-[#3730a3] font-medium hover:bg-[#eef2ff] rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add field
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function EntitiesTab({ entities, planId, onUpdate, readOnly = false }: Props) {
  const [nodes,      setNodes]      = useState<Node[]>(() => (entities?.nodes ?? []) as Node[]);
  const [edges,      setEdges]      = useState<Edge[]>(() => {
    const normalized = ((entities?.edges ?? []) as Edge[]).map((e) => {
      const relLabel =
        (e as { data?: { relationshipType?: string } }).data?.relationshipType ??
        (e as { label?: string }).label ??
        "has many";
      return { ...e, ...edgeStyle(relLabel) };
    });
    return addMissingFkEdges((entities?.nodes ?? []) as Node[], normalized).edges;
  });
  const [viewMode,   setViewMode]   = useState<"entities" | "erd">("entities");
  const [drawer,     setDrawer]     = useState<DrawerState | null>(null);
  const [edgeDialog, setEdgeDialog] = useState<EdgeDialogState | null>(null);
  const [showHelp,   setShowHelp]   = useState(false);
  const [syncInfo,   setSyncInfo]   = useState<string>("");
  const helpRef       = useRef<HTMLDivElement>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitRef    = useRef(false);

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  // Always-current refs — assigned directly in render body so they never lag.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const historyRef    = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const historyIdxRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Core push: takes explicit values so there is no timing dependency on refs/renders.
  const pushSnapshot = useCallback((ns: Node[], es: Edge[]) => {
    const snap = {
      nodes: ns.map((n) => ({ ...n })),
      edges: es.map((e) => ({ ...e })),
    };
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(snap);
    if (historyRef.current.length > 60) historyRef.current.shift();
    else historyIdxRef.current = historyRef.current.length - 1;
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(false);
  }, []);

  // Convenience alias for cases where state is already committed (e.g. drag stop,
  // initial capture). Uses refs which are always current at point-of-call.
  const snapshotHistory = useCallback(() => {
    pushSnapshot(nodesRef.current, edgesRef.current);
  }, [pushSnapshot]);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const { nodes: ns, edges: es } = historyRef.current[historyIdxRef.current];
    setNodes(ns.map((n) => ({ ...n })));
    setEdges(es.map((e) => ({ ...e })));
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    const { nodes: ns, edges: es } = historyRef.current[historyIdxRef.current];
    setNodes(ns.map((n) => ({ ...n })));
    setEdges(es.map((e) => ({ ...e })));
    setCanUndo(true);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }, []);

  const persistEntities = useCallback((nextNodes: Node[], nextEdges: Edge[]) => {
    if (readOnly) return;
    const payload = {
      nodes: nextNodes as RFNode[],
      edges: nextEdges as RFEdge[],
    };
    onUpdate?.(payload);

    if (!planId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/plans/${planId}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ entities: payload }),
        });
      } catch {
        // Silent optimistic save
      }
    }, 700);
  }, [onUpdate, planId, readOnly]);

  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }
    persistEntities(nodes, edges);
  }, [edges, nodes, persistEntities]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showHelp) return;
    function handler(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as unknown as globalThis.Node)) setShowHelp(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showHelp]);

  // Capture initial state as history[0]
  useEffect(() => {
    snapshotHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    if (readOnly) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      // Never intercept keys while the user is typing in an input/textarea
      const isTyping =
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable;

      // ── Undo / Redo ──────────────────────────────────────────────────────
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key === "z") { e.preventDefault(); undo(); return; }
      if (mod && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); redo(); return; }

      // ── Delete / Backspace — remove selected nodes + edges ────────────────
      // We own this entirely (deleteKeyCode={null} on ReactFlow) so we get full
      // control: both Delete AND Backspace work, history is always captured with
      // the correct final values (no timing race on refs).
      if ((e.key === "Delete" || e.key === "Backspace") && !isTyping && !drawer) {
        const selNodes = nodesRef.current.filter((n) => n.selected);
        const selEdges = edgesRef.current.filter((ed) => ed.selected);
        if (selNodes.length === 0 && selEdges.length === 0) return;
        e.preventDefault();
        const deletedNodeIds = new Set(selNodes.map((n) => n.id));
        const newNodes = nodesRef.current.filter((n) => !n.selected);
        const newEdges = edgesRef.current.filter(
          (ed) =>
            !ed.selected &&
            !deletedNodeIds.has(ed.source) &&
            !deletedNodeIds.has(ed.target),
        );
        setNodes(newNodes);
        setEdges(newEdges);
        pushSnapshot(newNodes, newEdges);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readOnly, undo, redo, drawer, pushSnapshot]);

  // Switch view mode — close ERD-specific overlays when moving to Entities view
  function switchView(mode: "entities" | "erd") {
    if (mode === "entities") {
      setDrawer(null);
      setEdgeDialog(null);
      setShowHelp(false);
    }
    setViewMode(mode);
  }

  // ── ReactFlow callbacks ────────────────────────────────────────────────────
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) return;
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [readOnly]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) return;
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [readOnly]
  );

  const onConnect = useCallback((params: Connection) => {
    if (readOnly) return;
    // Compute new edges explicitly so pushSnapshot gets the correct final value —
    // no timing race between setEdges re-render and history capture.
    const newEdges = addEdge(
      { ...params, id: `e-${Date.now()}`, ...edgeStyle("has many") },
      edgesRef.current,
    );
    setEdges(newEdges);
    pushSnapshot(nodesRef.current, newEdges);
  }, [readOnly, pushSnapshot]);

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    if (readOnly) return;
    const d    = node.data as EntityNodeData;
    const snap = { name: d.name ?? "", description: d.description ?? "", fields: d.fields ? [...d.fields] : [] };
    setDrawer({ nodeId: node.id, ...snap, original: snap });
  }, [readOnly]);

  const onEdgeDoubleClick = useCallback((evt: React.MouseEvent, edge: Edge) => {
    if (readOnly) return;
    const relType =
      (edge.data as { relationshipType?: string })?.relationshipType ??
      String(edge.label ?? "has many");
    setEdgeDialog({
      edgeId:  edge.id,
      label:   relType,
      clientX: evt.clientX,
      clientY: evt.clientY,
    });
  }, [readOnly]);

  // Snapshot position after user finishes dragging a node
  const onNodeDragStop = useCallback(() => {
    if (readOnly) return;
    setTimeout(snapshotHistory, 0);
  }, [readOnly, snapshotHistory]);

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  function updateDrawer(patch: Partial<Omit<DrawerState, "nodeId" | "original" | "isNew">>) {
    if (readOnly) return;
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
    if (readOnly) return;
    if (!drawer) return;
    const fields = drawer.fields.map((f, i) => (i === idx ? { ...f, [key]: value } : f));
    updateDrawer({ fields });
  }

  function addField() {
    if (readOnly) return;
    if (!drawer) return;
    updateDrawer({ fields: [...drawer.fields, { name:"", type:"VARCHAR(255)", isPrimary:false, isNullable:true }] });
  }

  function removeField(idx: number) {
    if (readOnly) return;
    if (!drawer) return;
    updateDrawer({ fields: drawer.fields.filter((_, i) => i !== idx) });
  }

  function saveDrawer()  {
    if (readOnly) return;
    // Drawer edits were applied live via updateDrawer — refs are current.
    pushSnapshot(nodesRef.current, edgesRef.current);
    setDrawer(null);
  }

  function cancelDrawer() {
    if (readOnly) return;
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
    if (readOnly) return;
    if (!drawer) return;
    const newNodes = nodesRef.current.filter((n) => n.id !== drawer.nodeId);
    const newEdges = edgesRef.current.filter(
      (e) => e.source !== drawer.nodeId && e.target !== drawer.nodeId,
    );
    setNodes(newNodes);
    setEdges(newEdges);
    setDrawer(null);
    pushSnapshot(newNodes, newEdges);
  }

  // ── Entity list-view helpers (inline editing, no drawer) ──────────────────
  function updateNodeData(nodeId: string, patch: Partial<EntityNodeData>) {
    if (readOnly) return;
    setNodes((nds) =>
      nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)
    );
  }

  function listUpdateField(nodeId: string, idx: number, key: keyof EntityField, val: string | boolean) {
    if (readOnly) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;
        const data = n.data as EntityNodeData;
        return { ...n, data: { ...data, fields: data.fields.map((f, i) => (i === idx ? { ...f, [key]: val } : f)) } };
      })
    );
  }

  function listAddField(nodeId: string) {
    if (readOnly) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;
        const data = n.data as EntityNodeData;
        return { ...n, data: { ...data, fields: [...(data.fields ?? []), { name:"", type:"VARCHAR(255)", isPrimary:false, isNullable:true }] } };
      })
    );
  }

  function listRemoveField(nodeId: string, idx: number) {
    if (readOnly) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;
        const data = n.data as EntityNodeData;
        return { ...n, data: { ...data, fields: data.fields.filter((_, i) => i !== idx) } };
      })
    );
  }

  function listDeleteEntity(nodeId: string) {
    if (readOnly) return;
    const newNodes = nodesRef.current.filter((n) => n.id !== nodeId);
    const newEdges = edgesRef.current.filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    );
    setNodes(newNodes);
    setEdges(newEdges);
    pushSnapshot(newNodes, newEdges);
  }

  // ── Add / auto-arrange ─────────────────────────────────────────────────────
  function addEntity() {
    if (readOnly) return;
    const id = `entity-${Date.now()}`;
    const defaultFields = [{ name:"id", type:"UUID", isPrimary:true, isNullable:false }];
    const newNode: Node = {
      id,
      type: "entityNode",
      position: { x: 80 + (nodes.length % 3) * 360, y: 80 + Math.floor(nodes.length / 3) * 280 },
      data: { name:"NewEntity", description:"", fields: defaultFields },
    };
    const newNodes = [...nodesRef.current, newNode];
    setNodes(newNodes);
    pushSnapshot(newNodes, edgesRef.current);

    // Only open the drawer when in ERD view; in Entities view, card is editable inline
    if (viewMode === "erd") {
      const snap = { name:"NewEntity", description:"", fields: defaultFields };
      setDrawer({ nodeId:id, ...snap, original:snap, isNew:true });
    }
  }

  function autoArrange() {
    if (readOnly) return;
    const arranged = autoLayoutEntities(nodesRef.current, edgesRef.current);
    setNodes(arranged);
    setTimeout(() => rfInstanceRef.current?.fitView({ duration: 600, padding: 0.25 }), 50);
    pushSnapshot(arranged, edgesRef.current);
  }

  function saveEdgeLabel() {
    if (readOnly) return;
    if (!edgeDialog) return;
    const newEdges = edgesRef.current.map((e) =>
      e.id === edgeDialog.edgeId ? { ...e, ...edgeStyle(edgeDialog.label) } : e,
    );
    setEdges(newEdges);
    setEdgeDialog(null);
    pushSnapshot(nodesRef.current, newEdges);
  }

  function syncForeignKeyLinks() {
    if (readOnly) return;
    const synced = addMissingFkEdges(nodesRef.current, edgesRef.current);
    if (synced.added === 0) {
      setSyncInfo("No missing FK links found.");
      setTimeout(() => setSyncInfo(""), 2200);
      return;
    }
    setEdges(synced.edges);
    setSyncInfo(`Added ${synced.added} FK link${synced.added > 1 ? "s" : ""}.`);
    setTimeout(() => setSyncInfo(""), 2600);
    pushSnapshot(nodesRef.current, synced.edges);
  }

  function dialogPos(clientX: number, clientY: number): { left: number; top: number } {
    const W = typeof window !== "undefined" ? window.innerWidth  : 1280;
    const H = typeof window !== "undefined" ? window.innerHeight : 800;
    return {
      left: Math.max(8, Math.min(clientX - 190, W - 396)),
      top:  Math.max(8, Math.min(clientY + 12,  H - 470)),
    };
  }

  const pkCount = drawer?.fields.filter((f) => f.isPrimary).length ?? 0;

  const activeRelTypes = Object.keys(REL_CONFIGS).filter(
    (label) => edges.some((e) => getRelationshipType(e) === label)
  );

  // ── Toggle pill ────────────────────────────────────────────────────────────
  const ViewToggle = (
    <div className="flex items-center bg-[#f1f5f9] rounded-lg p-0.5">
      {(["entities", "erd"] as const).map((v) => (
        <button
          key={v}
          onClick={() => switchView(v)}
          className={
            viewMode === v
              ? "text-[11px] font-semibold text-[#0f172a] bg-white rounded-md px-2.5 py-1 shadow-sm transition-all"
              : "text-[11px] font-medium text-[#64748b] px-2.5 py-1 transition-all hover:text-[#374151]"
          }
        >
          {v === "entities" ? "Entities" : "ERD"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative h-full flex">

      {/* ── Hidden SVG: per-relationship-color ERD marker definitions ──────── */}
      <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <defs>
          {/* One set of crow's-foot / single / arrow markers per relationship color */}
          {([
            ["4338ca", "#4338ca"], // has many
            ["7c3aed", "#7c3aed"], // belongs to
            ["0ea5e9", "#0ea5e9"], // has one
            ["e11d48", "#e11d48"], // many to many
            ["059669", "#059669"], // references
          ] as [string, string][]).map(([key, color]) => (
            <g key={key}>
              {/* crow's foot — many end */}
              <marker id={`erd-crowsfoot-${key}`} viewBox="0 -6 12 12" refX="11" refY="0"
                markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,-5 L12,0 L0,5 M0,-2.5 L12,0 M0,2.5 L12,0"
                  stroke={color} strokeWidth="1.5" fill="none"
                  strokeLinecap="round" strokeLinejoin="round" />
              </marker>
              {/* single tick — one end */}
              <marker id={`erd-single-${key}`} viewBox="0 -6 8 12" refX="6" refY="0"
                markerWidth="6" markerHeight="6" orient="auto">
                <line x1="6" y1="-5" x2="6" y2="5"
                  stroke={color} strokeWidth="1.8" strokeLinecap="round" />
              </marker>
              {/* open arrow — FK reference */}
              <marker id={`erd-arrow-${key}`} viewBox="0 -5 12 10" refX="10" refY="0"
                markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,-4 L12,0 L0,4"
                  stroke={color} strokeWidth="1.5" fill="none"
                  strokeLinejoin="round" strokeLinecap="round" />
              </marker>
            </g>
          ))}
        </defs>
      </svg>

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div className="flex-1 h-full flex flex-col min-w-0">

        {/* Toolbar */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 border-b border-[#e2e8f0] shrink-0"
          style={{ background:"linear-gradient(to bottom, #fff 0%, #fafbfc 100%)" }}
        >
          {!readOnly && (
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
          )}

          {/* Auto-arrange — ERD only */}
          {!readOnly && viewMode === "erd" && nodes.length > 1 && (
            <button
              onClick={autoArrange}
              title="Auto-arrange entities using hierarchy layout"
              className="flex items-center gap-1.5 text-xs text-[#4338ca] px-3 py-1.5 rounded-lg border border-[#c7d2fe] bg-[#eef2ff] hover:bg-[#e0e7ff] transition-all font-semibold shrink-0 active:scale-[0.97]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M4 12h10M4 19h7" />
              </svg>
              Auto-arrange
            </button>
          )}

          {!readOnly && nodes.length > 1 && (
            <button
              onClick={syncForeignKeyLinks}
              title="Create missing parent→child edges from *_id fields (e.g. functionId → Function)"
              className="flex items-center gap-1.5 text-xs text-[#0f766e] px-3 py-1.5 rounded-lg border border-[#99f6e4] bg-[#f0fdfa] hover:bg-[#ccfbf1] transition-all font-semibold shrink-0 active:scale-[0.97]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 7h10M7 12h10M7 17h6m4 0l3 0m0 0v-3m0 3l-3 0" />
              </svg>
              Link FK edges
            </button>
          )}

          {/* Undo / Redo */}
          {!readOnly && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z / ⌘Z)"
                className="w-7 h-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y / ⌘⇧Z)"
                className="w-7 h-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                </svg>
              </button>
            </div>
          )}

          <div className="h-4 w-px bg-[#e2e8f0]" />

          {/* Stats */}
          <div className="flex items-center gap-2 text-[11px] text-[#64748b]">
            <div className="flex items-center gap-1 bg-[#f8fafc] border border-[#e2e8f0] px-2 py-0.5 rounded-md">
              <svg className="w-3 h-3 text-[#4338ca]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h10" />
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
            {syncInfo && (
              <span className="text-[#0f766e] font-medium">{syncInfo}</span>
            )}
          </div>

          {/* Spacer */}
          <div className="ml-auto flex items-center gap-2">

            {/* Help icon — ERD only */}
            {viewMode === "erd" && (
              <div className="relative" ref={helpRef}>
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
            )}

            {/* View toggle pill */}
            {ViewToggle}
          </div>
        </div>

        {/* ── Entities list view ──────────────────────────────────────────── */}
        {viewMode === "entities" && (
          <div className="flex-1 overflow-auto bg-[#f5f6fa]">
            {nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-4">
                <div className="w-12 h-12 bg-[#4338ca]/8 border border-[#4338ca]/15 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#4338ca]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7h16M4 12h16M4 17h10" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0f172a] mb-1.5">No entities yet</p>
                  {readOnly ? (
                    <p className="text-xs text-[#64748b] leading-relaxed max-w-xs">
                      This shared plan does not include entities.
                    </p>
                  ) : (
                    <p className="text-xs text-[#64748b] leading-relaxed max-w-xs">
                      Click <strong className="text-[#4338ca]">+ Add Entity</strong> to define your data model,
                      or generate a plan to auto-populate.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="p-5"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(288px, 1fr))",
                  gap: 16,
                  alignItems: "start",
                }}
              >
                {nodes.map((node) => (
                  <EntityListCard
                    key={node.id}
                    node={node}
                    readOnly={readOnly}
                    onUpdateName={(id, name) => updateNodeData(id, { name })}
                    onUpdateDesc={(id, description) => updateNodeData(id, { description })}
                    onUpdateField={listUpdateField}
                    onAddField={listAddField}
                    onRemoveField={listRemoveField}
                    onDelete={listDeleteEntity}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ERD canvas view ─────────────────────────────────────────────── */}
        {viewMode === "erd" && (
          <div className="flex-1 relative" style={{ background:"#f8fafc" }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={readOnly ? undefined : onConnect}
              onNodeClick={readOnly ? undefined : onNodeClick}
              onEdgeDoubleClick={readOnly ? undefined : onEdgeDoubleClick}
              onInit={(instance) => { rfInstanceRef.current = instance; }}
              onNodeDragStop={onNodeDragStop}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionLineType={ConnectionLineType.SmoothStep}
              connectionLineStyle={{ stroke:"#6366f1", strokeWidth:1.8, strokeDasharray:"6 4" }}
              nodesDraggable={!readOnly}
              nodesConnectable={!readOnly}
              elementsSelectable
              deleteKeyCode={null}
              multiSelectionKeyCode="Shift"
              snapToGrid
              snapGrid={[12, 12]}
              connectionRadius={40}
              elevateEdgesOnSelect
              edgesFocusable
              fitView
              fitViewOptions={{ padding:0.3 }}
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
                    {readOnly ? (
                      <p className="text-xs text-[#64748b] leading-relaxed">
                        This shared plan does not include entities.
                      </p>
                    ) : (
                      <p className="text-xs text-[#64748b] leading-relaxed">
                        Click <strong className="text-[#4338ca]">+ Add Entity</strong> to create your data model,
                        or generate a plan to auto-populate.
                      </p>
                    )}
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
        )}
      </div>

      {/* ── Floating edge-label dialog (ERD only) ─────────────────────────── */}
      {viewMode === "erd" && edgeDialog && (() => {
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

            <div className="fixed inset-0 z-40" onClick={() => setEdgeDialog(null)} />

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
              <div style={{ padding:"14px 16px 11px", borderBottom:"1px solid #f1f5f9", background:"linear-gradient(to bottom, #fafbff, white)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#0f172a]">Relationship Type</h3>
                    <p className="text-[10px] text-[#94a3b8] mt-0.5">Select type or type a custom label below</p>
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
                        padding:"10px 11px",
                        borderRadius:10,
                        border: isActive ? `1.5px solid ${cfg.color}` : "1.5px solid #e2e8f0",
                        background: isActive ? `${cfg.color}0d` : "white",
                        textAlign:"left",
                        cursor:"pointer",
                        transition:"all 0.1s",
                        position:"relative",
                        outline:"none",
                      }}
                      className={!isActive ? "hover:border-[#cbd5e1] hover:bg-[#f8fafc]" : ""}
                    >
                      {isActive && (
                        <div style={{
                          position:"absolute", top:7, right:7,
                          width:16, height:16, borderRadius:"50%",
                          background:cfg.color,
                          display:"flex", alignItems:"center", justifyContent:"center",
                        }}>
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6.5l2.5 2.5 5.5-5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                      <div style={{
                        display:"inline-flex", alignItems:"center",
                        padding:"2px 7px", borderRadius:4, marginBottom:6,
                        background: isActive ? cfg.color : "#f1f5f9",
                        color: isActive ? "white" : "#64748b",
                        fontSize:10, fontFamily:"monospace", fontWeight:700, letterSpacing:"0.06em",
                      }}>
                        {cfg.notation}
                      </div>
                      <div style={{ fontSize:12, fontWeight:600, color: isActive ? cfg.color : "#0f172a", marginBottom:3 }}>
                        {relLabel}
                      </div>
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
              <div style={{ padding:"10px 14px", borderTop:"1px solid #f1f5f9", display:"flex", gap:8 }}>
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

      {/* ── Entity Edit Drawer (ERD only) ────────────────────────────────── */}
      {viewMode === "erd" && drawer && (
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
                    <div className="flex gap-1.5 mb-2">
                      <input
                        value={field.name}
                        onChange={(e) => updateField(i, "name", e.target.value)}
                        placeholder="field_name"
                        className="flex-1 bg-white border border-[#e2e8f0] rounded-lg px-2 py-1.5 text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#4338ca]/40 font-mono min-w-0 transition-colors"
                      />
                      <select
                        value={field.type}
                        onChange={(e) => updateField(i, "type", e.target.value)}
                        className="w-[126px] bg-white border border-[#e2e8f0] rounded-lg px-2 py-1.5 text-[11px] text-[#64748b] font-mono focus:outline-none focus:border-[#4338ca]/40 shrink-0 transition-colors"
                      >
                        {!hasPredefinedType(field.type) && (
                          <option value={field.type}>{field.type}</option>
                        )}
                        {FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateField(i, "isPrimary", !field.isPrimary)}
                        style={{
                          display:"flex", alignItems:"center", gap:4,
                          padding:"3px 8px", borderRadius:20,
                          border:`1px solid ${field.isPrimary ? "#FDE68A" : "#e2e8f0"}`,
                          background: field.isPrimary ? "#FEF3C7" : "white",
                          color:      field.isPrimary ? "#92400E"  : "#94A3B8",
                          fontSize:10, fontWeight:600, cursor:"pointer", transition:"all 0.1s",
                        }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                          <circle cx="8" cy="9" r="4.5" stroke="currentColor" strokeWidth="2"/>
                          <path d="M12.5 9H20M18 9V13M15.5 9V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        PK
                      </button>

                      <button
                        type="button"
                        onClick={() => updateField(i, "isNullable", !field.isNullable)}
                        style={{
                          padding:"3px 8px", borderRadius:20,
                          border:`1px solid ${field.isNullable ? "#CBD5E1" : "#e2e8f0"}`,
                          background: field.isNullable ? "#F1F5F9" : "white",
                          color:      field.isNullable ? "#475569"  : "#94A3B8",
                          fontSize:10, fontWeight:500, cursor:"pointer", transition:"all 0.1s",
                        }}
                      >
                        null?
                      </button>

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
