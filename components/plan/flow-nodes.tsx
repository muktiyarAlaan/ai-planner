"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { FlowNodeData } from "@/types/plan";

// ── Flow Start node ───────────────────────────────────────────────────────────
function FlowStartComponent({ data }: NodeProps<FlowNodeData>) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #34d399 0%, #059669 100%)",
        borderRadius: 20,
        padding: "10px 22px",
        minWidth: 185,
        textAlign: "center",
        boxShadow:
          "0 4px 16px rgba(16,185,129,0.35), 0 1px 3px rgba(16,185,129,0.15)",
        border: "1px solid rgba(255,255,255,0.25)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="white"
          style={{ opacity: 0.9, flexShrink: 0 }}
        >
          <path d="M8 5v14l11-7z" />
        </svg>
        <span
          style={{
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {data.label}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: "#059669",
          border: "2.5px solid #fff",
          width: 10,
          height: 10,
        }}
      />
    </div>
  );
}

// ── Flow Step node ────────────────────────────────────────────────────────────
function FlowStepComponent({ data, selected }: NodeProps<FlowNodeData>) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: "12px 18px 12px 20px",
        minWidth: 195,
        textAlign: "center",
        boxShadow: selected
          ? "0 4px 18px rgba(99,102,241,0.18)"
          : "0 1px 4px rgba(0,0,0,0.07)",
        border: selected ? "1px solid #6366f1" : "1px solid #e2e8f0",
        borderLeft: "3px solid #6366f1",
        transition: "all 0.15s ease",
      }}
    >
      <span
        style={{
          color: "#1e293b",
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.4,
          display: "block",
        }}
      >
        {data.label}
      </span>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: "#6366f1",
          border: "2.5px solid #fff",
          width: 9,
          height: 9,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: "#6366f1",
          border: "2.5px solid #fff",
          width: 9,
          height: 9,
        }}
      />
    </div>
  );
}

// ── Flow Decision node ────────────────────────────────────────────────────────
function FlowDecisionComponent({ data }: NodeProps<FlowNodeData>) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 175,
        height: 135,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: "#f59e0b",
          border: "2.5px solid #fff",
          width: 9,
          height: 9,
          top: 3,
        }}
      />
      {/* Diamond background */}
      <div
        style={{
          position: "absolute",
          width: 100,
          height: 100,
          background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
          border: "2px solid #f59e0b",
          borderRadius: 8,
          transform: "rotate(45deg)",
          boxShadow: "0 2px 10px rgba(245,158,11,0.2)",
        }}
      />
      {/* Label (counter-rotated) */}
      <span
        style={{
          position: "relative",
          zIndex: 10,
          color: "#78350f",
          fontSize: 12,
          fontWeight: 600,
          textAlign: "center",
          maxWidth: 120,
          lineHeight: 1.35,
          padding: "0 14px",
        }}
      >
        {data.label}
      </span>
      {/* Yes — bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{
          background: "#10b981",
          border: "2.5px solid #fff",
          width: 9,
          height: 9,
          bottom: 3,
        }}
      />
      {/* No — right */}
      <Handle
        type="source"
        position={Position.Right}
        id="no"
        style={{
          background: "#ef4444",
          border: "2.5px solid #fff",
          width: 9,
          height: 9,
          right: 3,
        }}
      />
    </div>
  );
}

// ── Flow End node ─────────────────────────────────────────────────────────────
function FlowEndComponent({ data }: NodeProps<FlowNodeData>) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #334155 0%, #1e293b 100%)",
        borderRadius: 20,
        padding: "10px 22px",
        minWidth: 175,
        textAlign: "center",
        boxShadow:
          "0 4px 14px rgba(0,0,0,0.22), 0 1px 3px rgba(0,0,0,0.12)",
        border: "1px solid #475569",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            background: "#94a3b8",
            borderRadius: 2,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: "#cbd5e1",
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
          }}
        >
          {data.label}
        </span>
      </div>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: "#475569",
          border: "2.5px solid #fff",
          width: 9,
          height: 9,
        }}
      />
    </div>
  );
}

export const FlowStartNode = memo(FlowStartComponent);
export const FlowStepNode = memo(FlowStepComponent);
export const FlowDecisionNode = memo(FlowDecisionComponent);
export const FlowEndNode = memo(FlowEndComponent);
