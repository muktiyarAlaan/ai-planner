"use client";

import { useCallback, useState, useRef } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  MarkerType,
  addEdge,
  Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import { FlowStartNode, FlowStepNode, FlowDecisionNode, FlowEndNode } from "./flow-nodes";
import { RFNode, RFEdge, FlowNodeData } from "@/types/plan";

const nodeTypes = {
  flowStart:    FlowStartNode,
  flowStep:     FlowStepNode,
  flowDecision: FlowDecisionNode,
  flowEnd:      FlowEndNode,
};

type FlowNodeType = "flowStart" | "flowStep" | "flowDecision" | "flowEnd";

interface Props {
  userFlows: { nodes: RFNode[]; edges: RFEdge[] } | null;
  planId: string;
  onUpdate: (flows: { nodes: RFNode[]; edges: RFEdge[] }) => void;
  readOnly?: boolean;
}

const NODE_META: Record<string, { label: string; color: string }> = {
  flowStart:    { label: "Start",    color: "#10b981" },
  flowStep:     { label: "Step",     color: "#6366f1" },
  flowDecision: { label: "Decision", color: "#f59e0b" },
  flowEnd:      { label: "End",      color: "#334155" },
};

const NODE_TYPE_OPTIONS: { value: FlowNodeType; label: string }[] = [
  { value: "flowStart",    label: "Start" },
  { value: "flowStep",     label: "Step" },
  { value: "flowDecision", label: "Decision" },
  { value: "flowEnd",      label: "End" },
];

function NodeLegendIcon({ type }: { type: string }) {
  if (type === "flowStart")
    return <div style={{ width: 22, height: 10, borderRadius: 99, background: "linear-gradient(135deg, #34d399, #059669)" }} />;
  if (type === "flowStep")
    return <div style={{ width: 18, height: 14, borderRadius: 3, background: "#fff", border: "1px solid #e2e8f0", borderLeft: "3px solid #6366f1" }} />;
  if (type === "flowDecision")
    return <div style={{ width: 13, height: 13, background: "#fef3c7", border: "2px solid #f59e0b", transform: "rotate(45deg)", borderRadius: 2, flexShrink: 0 }} />;
  if (type === "flowEnd")
    return <div style={{ width: 22, height: 10, borderRadius: 99, background: "linear-gradient(135deg, #475569, #1e293b)", border: "1px solid #334155" }} />;
  return null;
}

function getNodeColor(node: Node): string {
  return NODE_META[node.type ?? ""]?.color ?? "#e2e8f0";
}

export function UserFlowsTab({ userFlows, planId, onUpdate, readOnly = false }: Props) {
  const [nodes, setNodes] = useState<Node[]>(() => (userFlows?.nodes ?? []) as Node[]);
  const [edges, setEdges] = useState<Edge[]>(() =>
    (userFlows?.edges ?? []).map((e) => ({
      ...e,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 16, height: 16 },
      style: { stroke: "#94a3b8", strokeWidth: 1.5 },
      labelStyle: { fill: "#475569", fontSize: 11, fontWeight: 500 },
      labelBgStyle: { fill: "#fff", fillOpacity: 0.93 },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
    })) as Edge[]
  );
  const [selectedNode,   setSelectedNode]   = useState<Node | null>(null);
  const [editingLabel,   setEditingLabel]   = useState(false);
  const [labelDraft,     setLabelDraft]     = useState("");
  const [showTypeMenu,   setShowTypeMenu]   = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced auto-save
  function persistFlows(updatedNodes: Node[], updatedEdges: Edge[]) {
    if (readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const flows = { nodes: updatedNodes as RFNode[], edges: updatedEdges as RFEdge[] };
      onUpdate(flows);
      try {
        await fetch(`/api/plans/${planId}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ userFlows: flows }),
        });
      } catch { /* silent */ }
    }, 1000);
  }

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        persistFlows(updated, edges);
        return updated;
      }),
    [edges]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        persistFlows(nodes, updated);
        return updated;
      }),
    [nodes]
  );

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => {
        const updated = addEdge({
          ...connection,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 16, height: 16 },
          style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        }, eds);
        persistFlows(nodes, updated);
        return updated;
      }),
    [nodes]
  );

  // Double-click node → edit label (edit mode only)
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (readOnly) return;
    setSelectedNode(node);
    setLabelDraft((node.data as FlowNodeData).label ?? "");
    setEditingLabel(true);
    setShowTypeMenu(false);
  }, [readOnly]);

  // Single click → select (edit mode only)
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (readOnly) return;
    setSelectedNode(node);
    setEditingLabel(false);
    setShowTypeMenu(false);
  }, [readOnly]);

  function saveLabel() {
    if (!selectedNode) return;
    const trimmed = labelDraft.trim();
    if (!trimmed) { setEditingLabel(false); return; }
    const updated = nodes.map((n) =>
      n.id === selectedNode.id ? { ...n, data: { ...n.data, label: trimmed } } : n
    );
    setNodes(updated);
    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, label: trimmed } });
    setEditingLabel(false);
    persistFlows(updated, edges);
  }

  function changeNodeType(type: FlowNodeType) {
    if (!selectedNode) return;
    const updated = nodes.map((n) =>
      n.id === selectedNode.id ? { ...n, type } : n
    );
    setNodes(updated);
    setSelectedNode({ ...selectedNode, type });
    setShowTypeMenu(false);
    persistFlows(updated, edges);
  }

  function deleteNode() {
    if (!selectedNode) return;
    const updatedNodes = nodes.filter((n) => n.id !== selectedNode.id);
    const updatedEdges = edges.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id);
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    setSelectedNode(null);
    persistFlows(updatedNodes, updatedEdges);
  }

  function addStep() {
    const id = `node-${Date.now()}`;
    const centerX = 250;
    const centerY = 200 + nodes.length * 80;
    const newNode: Node = {
      id,
      type: "flowStep",
      position: { x: centerX, y: centerY },
      data: { label: "New Step" },
    };
    const updated = [...nodes, newNode];
    setNodes(updated);
    persistFlows(updated, edges);
  }

  const typeCounts = nodes.reduce((acc, n) => {
    const t = n.type ?? "unknown";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!userFlows && nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="w-12 h-12 bg-[#f1f5f9] rounded-2xl flex items-center justify-center">
          <svg className="w-5 h-5 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </div>
        <p className="text-[13px] font-medium text-[#64748b]">No user flows generated</p>
        <button
          onClick={addStep}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg transition-colors shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Step
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-5 px-4 py-2.5 border-b border-[#e2e8f0] bg-white shrink-0">
        {/* Legend */}
        <div className="flex items-center gap-4">
          {Object.entries(NODE_META).map(([type, meta]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="flex items-center justify-center" style={{ width: 26 }}>
                <NodeLegendIcon type={type} />
              </div>
              <span className="text-[11px] text-[#64748b] font-medium">{meta.label}</span>
              {typeCounts[type] != null && (
                <span className="text-[10px] text-[#94a3b8] bg-[#f1f5f9] rounded-full px-1.5 py-0.5 font-medium leading-none">
                  {typeCounts[type]}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Right: stats + Add Step */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-[#94a3b8]">
            {nodes.length} node{nodes.length !== 1 ? "s" : ""} · {edges.length} edge{edges.length !== 1 ? "s" : ""}
          </span>
          <span className="text-[#e2e8f0]">|</span>
          {!readOnly && (
            <>
              <span className="text-[11px] text-[#94a3b8]">Double-click to edit</span>
              <button
                onClick={addStep}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg transition-colors shadow-sm"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Step
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1" style={{ background: "#f8fafc" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onPaneClick={() => { setSelectedNode(null); setEditingLabel(false); setShowTypeMenu(false); }}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} color="#dde3ec" gap={22} size={1.3} />
          <Controls
            style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
          />
          <MiniMap
            style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10 }}
            nodeColor={getNodeColor}
            maskColor="rgba(241,245,249,0.75)"
            pannable zoomable
          />

          {/* Node inspector / editor panel */}
          {selectedNode && (
            <Panel position="bottom-left" style={{ margin: 12 }}>
              <div
                className="bg-white border border-[#e2e8f0] rounded-xl shadow-xl overflow-hidden"
                style={{ minWidth: 230, maxWidth: 310 }}
              >
                {/* Header */}
                <div className="px-4 py-2.5 border-b border-[#f1f5f9] flex items-center justify-between bg-[#fafafa]">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center" style={{ width: 26 }}>
                      <NodeLegendIcon type={selectedNode.type ?? ""} />
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748b]">
                      {NODE_META[selectedNode.type ?? ""]?.label ?? selectedNode.type}
                    </span>
                  </div>
                  <button
                    onClick={() => { setSelectedNode(null); setEditingLabel(false); }}
                    className="w-5 h-5 flex items-center justify-center rounded-md text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f1f5f9] transition-colors text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Body */}
                <div className="px-4 py-3 space-y-2.5">
                  {editingLabel ? (
                    <div className="space-y-2">
                      <input
                        value={labelDraft}
                        onChange={(e) => setLabelDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveLabel(); if (e.key === "Escape") setEditingLabel(false); }}
                        autoFocus
                        className="w-full text-[13px] font-medium text-[#0f172a] bg-[#f8fafc] border border-[#7C3AED]/30 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#7C3AED]"
                      />
                      <div className="flex items-center gap-2">
                        <button onClick={saveLabel} className="text-[11px] font-medium px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors">Save</button>
                        <button onClick={() => setEditingLabel(false)} className="text-[11px] font-medium px-2.5 py-1 bg-[#f1f5f9] text-[#64748b] rounded-md transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] font-semibold text-[#0f172a] leading-snug">
                      {(selectedNode.data as FlowNodeData).label}
                    </p>
                  )}

                  {/* Toolbar */}
                  {!editingLabel && (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-[#f1f5f9] flex-wrap">
                      {/* Edit label */}
                      <button
                        onClick={() => { setLabelDraft((selectedNode.data as FlowNodeData).label ?? ""); setEditingLabel(true); }}
                        className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 bg-[#f1f5f9] hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] text-[#64748b] rounded-md transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit
                      </button>

                      {/* Change type */}
                      <div className="relative">
                        <button
                          onClick={() => setShowTypeMenu((v) => !v)}
                          className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 bg-[#f1f5f9] hover:bg-[#f5f3ff] hover:text-[#7C3AED] text-[#64748b] rounded-md transition-colors"
                        >
                          Type
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {showTypeMenu && (
                          <div className="absolute bottom-full mb-1 left-0 bg-white border border-[#e2e8f0] rounded-lg shadow-lg py-1 z-50 min-w-[110px]">
                            {NODE_TYPE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => changeNodeType(opt.value)}
                                className={`w-full text-left text-[11px] px-3 py-1.5 transition-colors flex items-center gap-2 ${
                                  selectedNode.type === opt.value
                                    ? "text-[#7C3AED] bg-[#f5f3ff]"
                                    : "text-[#374151] hover:bg-[#f8fafc]"
                                }`}
                              >
                                <div className="flex items-center justify-center" style={{ width: 20 }}>
                                  <NodeLegendIcon type={opt.value} />
                                </div>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Delete */}
                      <button
                        onClick={deleteNode}
                        className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 bg-[#f1f5f9] hover:bg-red-50 hover:text-red-500 text-[#64748b] rounded-md transition-colors ml-auto"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}

                  <p className="text-[10px] text-[#94a3b8] font-mono">id: {selectedNode.id}</p>
                </div>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
}
