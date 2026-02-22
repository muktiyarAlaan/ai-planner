"use client";

import { useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { EntityNodeData } from "@/types/plan";

const MAX_FIELDS = 6;

// Abbreviated display labels for common types
const TYPE_ABBR: Record<string, string> = {
  "VARCHAR(255)": "TEXT",
  "VARCHAR(100)": "TEXT",
  "VARCHAR(50)":  "TEXT",
  "VARCHAR(20)":  "TEXT",
  "INTEGER":      "INT",
  "BIGINT":       "BINT",
  "BOOLEAN":      "BOOL",
  "TIMESTAMP":    "TS",
  "TIMESTAMPTZ":  "TSZ",
  "DECIMAL(10,2)":"DEC",
  "FLOAT":        "FLT",
};

function shortType(type: string): string {
  const upper = type.toUpperCase().trim();
  if (TYPE_ABBR[upper]) return TYPE_ABBR[upper];
  if (/^VARCHAR\(\d+\)$/.test(upper)) return "TEXT";
  if (/^DECIMAL\(.+\)$/.test(upper)) return "DEC";
  return upper.length > 8 ? upper.slice(0, 7) + "…" : upper;
}

interface TypeTheme { bg: string; text: string }

function getTypeTheme(type: string): TypeTheme {
  const t = type.toUpperCase().trim();
  if (t.includes("UUID"))                                          return { bg: "#FEF3C7", text: "#92400E" };
  if (t.startsWith("VARCHAR") || t === "TEXT" || t.startsWith("CHAR")) return { bg: "#DBEAFE", text: "#1E40AF" };
  if (["INTEGER","INT","BIGINT","FLOAT","NUMERIC"].some(k => t === k) || t.startsWith("DECIMAL"))
                                                                   return { bg: "#DCFCE7", text: "#166534" };
  if (t.includes("TIMESTAMP") || t === "DATE" || t === "TIME")    return { bg: "#F3E8FF", text: "#6B21A8" };
  if (t === "BOOLEAN" || t === "BOOL")                            return { bg: "#CCFBF1", text: "#065F46" };
  if (t === "JSONB" || t === "JSON")                              return { bg: "#FFEDD5", text: "#9A3412" };
  if (t === "ENUM")                                               return { bg: "#FCE7F3", text: "#831843" };
  return { bg: "#F1F5F9", text: "#475569" };
}

// Not wrapped in memo — ensures real-time drawer edits reflect immediately on canvas
export function EntityNode({ data, selected }: NodeProps<EntityNodeData>) {
  const [expanded, setExpanded] = useState(false);
  const fields   = data.fields ?? [];
  const visible  = expanded ? fields : fields.slice(0, MAX_FIELDS);
  const hiddenCt = Math.max(0, fields.length - MAX_FIELDS);

  return (
    <div
      style={{
        background:    "white",
        borderRadius:  12,
        border:        selected ? "1.5px solid #4338ca" : "1.5px solid #e2e8f0",
        boxShadow:     selected
          ? "0 0 0 4px rgba(67,56,202,0.13), 0 8px 28px rgba(67,56,202,0.18)"
          : "0 2px 10px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
        minWidth:  236,
        maxWidth:  300,
        overflow:  "hidden",
        transition:"box-shadow 0.15s ease, border-color 0.15s ease",
        fontFamily:"inherit",
      }}
    >
      {/* ── Connection handles ────────────────────────────────────────────── */}
      <Handle type="target"   position={Position.Top}
        style={{ background:"#4338ca", border:"2.5px solid white", width:14, height:14, top:-7,
                 boxShadow:"0 0 0 3px rgba(67,56,202,0.2)", cursor:"crosshair", zIndex:20 }} />
      <Handle type="source"   position={Position.Bottom}
        style={{ background:"#4338ca", border:"2.5px solid white", width:14, height:14, bottom:-7,
                 boxShadow:"0 0 0 3px rgba(67,56,202,0.2)", cursor:"crosshair", zIndex:20 }} />
      <Handle type="source"   position={Position.Right} id="right"
        style={{ background:"#818cf8", border:"2px solid white", width:10, height:10, right:-5,
                 boxShadow:"0 0 0 2px rgba(129,140,248,0.25)", cursor:"crosshair", zIndex:20 }} />
      <Handle type="target"   position={Position.Left}  id="left"
        style={{ background:"#818cf8", border:"2px solid white", width:10, height:10, left:-5,
                 boxShadow:"0 0 0 2px rgba(129,140,248,0.25)", cursor:"crosshair", zIndex:20 }} />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        style={{
          background:"linear-gradient(135deg, #312e81 0%, #4338ca 55%, #6366f1 100%)",
          padding:"11px 13px 10px",
        }}
      >
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {/* Table icon */}
          <div style={{
            width:22, height:22, borderRadius:6,
            background:"rgba(255,255,255,0.16)",
            display:"flex", alignItems:"center", justifyContent:"center",
            flexShrink:0,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="0.6" y="0.6" width="10.8" height="10.8" rx="1.8"
                    stroke="rgba(255,255,255,0.9)" strokeWidth="1.1"/>
              <line x1="0.6"  y1="4.2" x2="11.4" y2="4.2" stroke="rgba(255,255,255,0.9)" strokeWidth="0.9"/>
              <line x1="5.2"  y1="4.2" x2="5.2"  y2="11.4" stroke="rgba(255,255,255,0.9)" strokeWidth="0.9"/>
            </svg>
          </div>

          <span style={{
            color:"white", fontWeight:700, fontSize:13,
            letterSpacing:"-0.015em", flex:1,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          }}>
            {data.name}
          </span>

          <span style={{
            color:"rgba(255,255,255,0.45)", fontSize:10,
            background:"rgba(0,0,0,0.16)",
            padding:"1px 6px", borderRadius:4,
            flexShrink:0, fontFamily:"monospace", fontWeight:600,
          }}>
            {fields.length}f
          </span>
        </div>

        {data.description && (
          <p style={{
            color:"rgba(255,255,255,0.5)", fontSize:10.5, marginTop:3,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            paddingLeft:30, lineHeight:1.4,
          }}>
            {data.description}
          </p>
        )}
      </div>

      {/* ── Field rows ───────────────────────────────────────────────────── */}
      <div style={{ background:"white" }}>
        {visible.map((field, i) => {
          const theme   = getTypeTheme(field.type);
          const isLast  = i === visible.length - 1 && hiddenCt === 0;

          return (
            <div
              key={i}
              style={{
                display:"flex", alignItems:"center", gap:7,
                padding:"5px 13px",
                background: field.isPrimary ? "#FFFCF0" : "white",
                borderBottom: isLast ? undefined : "1px solid #F8FAFC",
                transition:"background 0.1s",
              }}
            >
              {/* PK key icon */}
              {field.isPrimary ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0 }}>
                  <circle cx="8" cy="9" r="4.5" stroke="#F59E0B" strokeWidth="2.2"/>
                  <path d="M12.5 9H20.5M18.5 9V13M16 9V12"
                        stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              ) : (
                <div style={{ width:11, flexShrink:0 }} />
              )}

              {/* Field name */}
              <span style={{
                flex:1, fontSize:11,
                color:      field.isPrimary ? "#92400E" : "#1E293B",
                fontWeight: field.isPrimary ? 600 : 450,
                fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                letterSpacing:"-0.01em",
              }}>
                {field.name || (
                  <span style={{ color:"#94a3b8", fontStyle:"italic", fontWeight:400 }}>
                    unnamed
                  </span>
                )}
              </span>

              {/* Type badge */}
              <span style={{
                fontSize:9, fontFamily:"monospace", fontWeight:700,
                background:theme.bg, color:theme.text,
                padding:"1.5px 5px", borderRadius:3,
                flexShrink:0, letterSpacing:"0.04em",
                maxWidth:66, overflow:"hidden", textOverflow:"ellipsis",
              }}>
                {shortType(field.type)}
              </span>

              {/* Nullable marker */}
              {!field.isPrimary && field.isNullable && (
                <span style={{ fontSize:10, color:"#CBD5E1", flexShrink:0, fontWeight:700, lineHeight:1 }}>
                  ?
                </span>
              )}
            </div>
          );
        })}

        {/* Show-more toggle */}
        {hiddenCt > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
            className="hover:text-[#4338ca] hover:bg-[#f5f3ff] transition-colors"
            style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
              gap:4, padding:"6px 0", fontSize:10, cursor:"pointer",
              background:"transparent", border:"none", borderTop:"1px solid #F1F5F9",
              color:"#94A3B8",
            }}
          >
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              style={{ transform: expanded ? "rotate(180deg)" : "none", transition:"transform 0.15s" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
            {expanded ? "Collapse" : `+${hiddenCt} more field${hiddenCt > 1 ? "s" : ""}`}
          </button>
        )}

        {/* Empty state */}
        {fields.length === 0 && (
          <div style={{
            padding:"11px 13px", textAlign:"center",
            fontSize:11, color:"#94A3B8", fontStyle:"italic",
          }}>
            No fields — click to edit
          </div>
        )}
      </div>
    </div>
  );
}
