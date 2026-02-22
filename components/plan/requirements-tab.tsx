"use client";

import { useState, useRef, useEffect } from "react";
import { PlanRequirements } from "@/types/plan";

interface Props {
  requirements: PlanRequirements | null;
  planId: string;
  onUpdate: (reqs: PlanRequirements) => void;
}

// ── Auto-growing textarea ─────────────────────────────────────────────────────
function AutoTextarea({
  value,
  onChange,
  onCancel,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onCancel?: () => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
      ref.current.focus();
    }
  });

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel?.();
      }}
      placeholder={placeholder}
      rows={1}
      className="w-full text-sm text-[#374151] leading-relaxed bg-[#fafbff] border border-[#7C3AED]/30 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 overflow-hidden"
      style={{ minHeight: 36 }}
    />
  );
}

// ── Editable requirement item ─────────────────────────────────────────────────
function ReqItem({
  text,
  onSave,
  onDelete,
  isNew,
  isOutOfScope,
}: {
  text: string;
  onSave: (newText: string) => void;
  onDelete: () => void;
  isNew?: boolean;
  isOutOfScope?: boolean;
}) {
  const [editing, setEditing] = useState(isNew ?? false);
  const [draft,   setDraft]   = useState(text);
  const [confirm, setConfirm] = useState(false);

  function save() {
    const trimmed = draft.trim();
    if (!trimmed) { cancel(); return; }
    onSave(trimmed);
    setEditing(false);
  }

  function cancel() {
    if (isNew) {
      onDelete();
    } else {
      setDraft(text);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <AutoTextarea
          value={draft}
          onChange={setDraft}
          onCancel={cancel}
          placeholder="Enter requirement…"
        />
        <div className="flex items-center gap-2">
          <button
            onMouseDown={save}
            className="text-[11px] font-medium px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
          >
            Save
          </button>
          <button
            onMouseDown={cancel}
            className="text-[11px] font-medium px-2.5 py-1 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 group/item">
      {isOutOfScope ? (
        <span className="text-[#94a3b8] text-sm mt-0.5 shrink-0">—</span>
      ) : (
        <div className="w-4 h-4 rounded border border-[#e2e8f0] bg-[#f8fafc] mt-0.5 shrink-0 flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-[#7C3AED]" fill="none" stroke="currentColor" viewBox="0 0 12 12">
            <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <span className={`text-sm leading-relaxed flex-1 ${isOutOfScope ? "text-[#94a3b8] line-through decoration-[#cbd5e1]" : "text-[#374151]"}`}>
        {text}
      </span>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
        <button
          onClick={() => { setDraft(text); setEditing(true); }}
          className="w-6 h-6 flex items-center justify-center rounded text-[#94a3b8] hover:text-[#7C3AED] hover:bg-[#f5f3ff] transition-colors"
          title="Edit"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        {confirm ? (
          <div className="flex items-center gap-1">
            <button
              onClick={onDelete}
              className="text-[10px] font-medium px-1.5 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="text-[10px] font-medium px-1.5 py-0.5 bg-[#f1f5f9] text-[#64748b] rounded transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="w-6 h-6 flex items-center justify-center rounded text-[#94a3b8] hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Add button at bottom ──────────────────────────────────────────────────────
function AddItemRow({
  onAdd,
  placeholder,
}: {
  onAdd: (text: string) => void;
  placeholder?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft,  setDraft]  = useState("");

  function save() {
    const trimmed = draft.trim();
    if (!trimmed) { cancel(); return; }
    onAdd(trimmed);
    setDraft("");
    setAdding(false);
  }

  function cancel() {
    setDraft("");
    setAdding(false);
  }

  if (adding) {
    return (
      <div className="space-y-1.5 mt-1">
        <AutoTextarea
          value={draft}
          onChange={setDraft}
          onCancel={cancel}
          placeholder={placeholder ?? "Enter item…"}
        />
        <div className="flex items-center gap-2">
          <button
            onMouseDown={save}
            className="text-[11px] font-medium px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
          >
            Save
          </button>
          <button
            onMouseDown={cancel}
            className="text-[11px] font-medium px-2.5 py-1 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setAdding(true)}
      className="flex items-center gap-1.5 text-[11px] text-[#94a3b8] hover:text-[#7C3AED] transition-colors mt-2 group/add"
    >
      <span className="w-4 h-4 rounded border border-dashed border-[#cbd5e1] group-hover/add:border-[#7C3AED] flex items-center justify-center transition-colors">
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </span>
      Add item
    </button>
  );
}

// ── Main tab ─────────────────────────────────────────────────────────────────
export function RequirementsTab({ requirements, planId, onUpdate }: Props) {
  const [reqs, setReqs] = useState<PlanRequirements>(
    requirements ?? { functional: [], nonFunctional: [], outOfScope: [] }
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function persist(updated: PlanRequirements) {
    setReqs(updated);
    onUpdate(updated);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/plans/${planId}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ requirements: updated }),
        });
      } catch {
        // Silent — optimistic update already applied
      }
    }, 600);
  }

  function updateItem(section: keyof PlanRequirements, i: number, text: string) {
    const arr = [...(reqs[section] ?? [])];
    if (i < arr.length) arr[i] = text;
    else arr.push(text);
    persist({ ...reqs, [section]: arr });
  }

  function deleteItem(section: keyof PlanRequirements, i: number) {
    const arr = [...(reqs[section] ?? [])];
    arr.splice(i, 1);
    persist({ ...reqs, [section]: arr });
  }

  function addItem(section: keyof PlanRequirements, text: string) {
    const arr = [...(reqs[section] ?? []), text];
    persist({ ...reqs, [section]: arr });
  }

  if (!requirements && reqs.functional.length === 0 && reqs.nonFunctional.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#94a3b8] text-sm">
        No requirements generated
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Functional */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">
            Functional Requirements
          </h3>
          <div className="space-y-2.5">
            {(reqs.functional ?? []).map((req, i) => (
              <ReqItem
                key={i}
                text={req}
                onSave={(text) => updateItem("functional", i, text)}
                onDelete={() => deleteItem("functional", i)}
              />
            ))}
          </div>
          <AddItemRow
            onAdd={(text) => addItem("functional", text)}
            placeholder="Enter functional requirement…"
          />
        </div>

        {/* Non-Functional */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">
            Non-Functional Requirements
          </h3>
          <div className="space-y-2.5">
            {(reqs.nonFunctional ?? []).map((req, i) => (
              <ReqItem
                key={i}
                text={req}
                onSave={(text) => updateItem("nonFunctional", i, text)}
                onDelete={() => deleteItem("nonFunctional", i)}
                icon={<div className="w-4 h-4 rounded border border-[#e2e8f0] bg-[#f8fafc] mt-0.5 shrink-0" />}
              />
            ))}
          </div>
          <AddItemRow
            onAdd={(text) => addItem("nonFunctional", text)}
            placeholder="Enter non-functional requirement…"
          />
        </div>
      </div>

      {/* Out of scope */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
        <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">
          Out of Scope
        </h3>
        <div className="space-y-1.5">
          {(reqs.outOfScope ?? []).map((item, i) => (
            <ReqItem
              key={i}
              text={item}
              isOutOfScope
              onSave={(text) => updateItem("outOfScope", i, text)}
              onDelete={() => deleteItem("outOfScope", i)}
            />
          ))}
        </div>
        <AddItemRow
          onAdd={(text) => addItem("outOfScope", text)}
          placeholder="Enter out-of-scope item…"
        />
      </div>
    </div>
  );
}
