"use client";

import { memo, useState } from "react";
import { EdgeProps, getSmoothStepPath, EdgeLabelRenderer } from "reactflow";

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

// Per-relationship-type visual style
const REL_STYLE: Record<string, { color: string; notation: string; colorKey: string }> = {
  "has many":     { color: "#4338ca", notation: "1 : N", colorKey: "4338ca" },
  "belongs to":   { color: "#7c3aed", notation: "N : 1", colorKey: "7c3aed" },
  "has one":      { color: "#0ea5e9", notation: "1 : 1", colorKey: "0ea5e9" },
  "many to many": { color: "#e11d48", notation: "N : M", colorKey: "e11d48" },
  "references":   { color: "#059669", notation: "FK →",  colorKey: "059669" },
};

function getMarkers(
  relType: string,
  colorKey: string,
): { start?: string; end: string } {
  const normalized = NOTATION_TO_REL[relType] ?? relType;
  switch (normalized) {
    case "has many":
      return {
        start: `url(#erd-single-${colorKey})`,
        end:   `url(#erd-crowsfoot-${colorKey})`,
      };
    case "belongs to":
      return {
        start: `url(#erd-crowsfoot-${colorKey})`,
        end:   `url(#erd-single-${colorKey})`,
      };
    case "has one":
      return {
        start: `url(#erd-single-${colorKey})`,
        end:   `url(#erd-single-${colorKey})`,
      };
    case "many to many":
      return {
        start: `url(#erd-crowsfoot-${colorKey})`,
        end:   `url(#erd-crowsfoot-${colorKey})`,
      };
    case "references":
      return { end: `url(#erd-arrow-${colorKey})` };
    default:
      return {
        start: `url(#erd-single-${colorKey})`,
        end:   `url(#erd-crowsfoot-${colorKey})`,
      };
  }
}

export const ERDEdge = memo(function ERDEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label: edgeLabel,
  selected,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);

  // Resolve relationship type
  const rawRelType =
    (data?.relationshipType as string) ??
    (typeof edgeLabel === "string" ? edgeLabel : "has many");
  const relType = NOTATION_TO_REL[rawRelType] ?? rawRelType;

  const style = REL_STYLE[relType] ?? REL_STYLE["has many"];
  const { color, colorKey } = style;

  const isDashed = relType === "many to many" || relType === "references";
  const { start: markerStart, end: markerEnd } = getMarkers(relType, colorKey);

  // SmoothStep gives orthogonal (right-angle) routing — prevents edges from
  // passing through other nodes, inspired by Figma/Miro connector style.
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 14,
    offset: 40,
  });

  const strokeWidth   = selected ? 2.5 : hovered ? 2 : 1.5;
  const strokeOpacity = selected || hovered ? 1 : 0.72;
  const isHighlighted = selected || hovered;

  return (
    <>
      {/* Wide invisible hit area for easier interaction */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={22}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* Visible edge path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDasharray={isDashed ? "7 4" : undefined}
        strokeLinecap="round"
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={
          isHighlighted
            ? { filter: `drop-shadow(0 0 4px ${color}66)` }
            : undefined
        }
        className="react-flow__edge-path"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* Midpoint label — filled pill with white text + white ring */}
      <EdgeLabelRenderer>
        <div
          style={{
            position:  "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "none",
            opacity:   isHighlighted ? 1 : 0.88,
            transition:"opacity 0.15s",
            // At rest: zIndex 0 keeps labels below node divs so they never
            // bleed on top of node content. When the edge is hovered/selected
            // we jump to 9999 so the label always pops above everything.
            zIndex: isHighlighted ? 9999 : 0,
          }}
          className="nodrag nopan"
        >
          <span
            style={{
              display:       "inline-block",
              background:    color,
              borderRadius:  20,
              padding:       "2px 8px",
              fontSize:      9,
              fontFamily:    "monospace",
              fontWeight:    800,
              color:         "white",
              whiteSpace:    "nowrap",
              letterSpacing: "0.09em",
              // White ring creates visual separation from the edge line itself
              boxShadow:     `0 0 0 2.5px white, 0 2px 6px ${color}55`,
            }}
          >
            {relType}
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
