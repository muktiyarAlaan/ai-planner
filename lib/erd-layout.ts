import type { Node, Edge } from "reactflow";

export function autoLayoutEntities(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const HORIZONTAL_GAP = 390;
  const VERTICAL_GAP   = 320;
  const ORIGIN_X = 600;
  const ORIGIN_Y = 100;
  const MIN_GAP = 350;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const nodeIds = nodes.map((n) => n.id);

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of nodeIds) {
    outgoing.set(id, []);
    incoming.set(id, []);
    inDegree.set(id, 0);
  }

  // Build graph indexes from valid edges only.
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target) || edge.source === edge.target) continue;
    outgoing.get(edge.source)!.push(edge.target);
    incoming.get(edge.target)!.push(edge.source);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const levels = new Map<string, number>();
  const inDegreeTemp = new Map(inDegree);
  const queue: string[] = nodeIds.filter((id) => (inDegreeTemp.get(id) ?? 0) === 0);
  const processed = new Set<string>();

  if (queue.length === 0 && nodeIds.length > 0) {
    queue.push(nodeIds[0]);
  }

  while (queue.length > 0) {
    const id = queue.shift()!;
    processed.add(id);
    const currLevel = levels.get(id) ?? 0;
    const children = outgoing.get(id) ?? [];

    for (const childId of children) {
      const existing = levels.get(childId) ?? 0;
      if (currLevel + 1 > existing) {
        levels.set(childId, currLevel + 1);
      }
      const nextDegree = (inDegreeTemp.get(childId) ?? 0) - 1;
      inDegreeTemp.set(childId, nextDegree);
      if (nextDegree === 0) queue.push(childId);
    }
  }

  // Cycle fallback: place unresolved nodes near resolved parents, otherwise on level 0.
  for (const id of nodeIds) {
    if (levels.has(id)) continue;
    const resolvedParents = (incoming.get(id) ?? []).filter((parentId) => levels.has(parentId));
    if (resolvedParents.length === 0) {
      levels.set(id, 0);
      continue;
    }
    const parentMax = Math.max(...resolvedParents.map((parentId) => levels.get(parentId) ?? 0));
    levels.set(id, parentMax + 1);
  }

  const maxLevel = Math.max(...nodeIds.map((id) => levels.get(id) ?? 0), 0);
  const levelBuckets = new Map<number, string[]>();
  for (let l = 0; l <= maxLevel; l++) levelBuckets.set(l, []);
  for (const id of nodeIds) {
    const level = levels.get(id) ?? 0;
    levelBuckets.get(level)!.push(id);
  }

  function nodeName(id: string): string {
    const raw = (nodeById.get(id)?.data as { name?: unknown } | undefined)?.name;
    return typeof raw === "string" ? raw.toLowerCase() : id.toLowerCase();
  }

  // Stable initial ordering by current x, then name.
  for (let l = 0; l <= maxLevel; l++) {
    levelBuckets.get(l)!.sort((a, b) => {
      const ax = nodeById.get(a)?.position?.x ?? 0;
      const bx = nodeById.get(b)?.position?.x ?? 0;
      if (ax !== bx) return ax - bx;
      return nodeName(a).localeCompare(nodeName(b));
    });
  }

  function indexMap(level: number): Map<string, number> {
    return new Map((levelBuckets.get(level) ?? []).map((id, idx) => [id, idx]));
  }

  // Crossing reduction with barycentric sweeps.
  for (let iter = 0; iter < 4; iter++) {
    for (let level = 1; level <= maxLevel; level++) {
      const prevIndex = indexMap(level - 1);
      const ordered = (levelBuckets.get(level) ?? []).map((id, idx) => {
        const parents = (incoming.get(id) ?? []).filter((p) => (levels.get(p) ?? 0) === level - 1);
        if (parents.length === 0) return { id, score: idx + 1000 };
        const avg = parents.reduce((sum, p) => sum + (prevIndex.get(p) ?? 0), 0) / parents.length;
        return { id, score: avg };
      });
      ordered.sort((a, b) => (a.score - b.score) || nodeName(a.id).localeCompare(nodeName(b.id)));
      levelBuckets.set(level, ordered.map((x) => x.id));
    }

    for (let level = maxLevel - 1; level >= 0; level--) {
      const nextIndex = indexMap(level + 1);
      const ordered = (levelBuckets.get(level) ?? []).map((id, idx) => {
        const children = (outgoing.get(id) ?? []).filter((c) => (levels.get(c) ?? 0) === level + 1);
        if (children.length === 0) return { id, score: idx + 1000 };
        const avg = children.reduce((sum, c) => sum + (nextIndex.get(c) ?? 0), 0) / children.length;
        return { id, score: avg };
      });
      ordered.sort((a, b) => (a.score - b.score) || nodeName(a.id).localeCompare(nodeName(b.id)));
      levelBuckets.set(level, ordered.map((x) => x.id));
    }
  }

  const xById = new Map<string, number>();

  // Base evenly-spaced coordinates per level.
  for (let level = 0; level <= maxLevel; level++) {
    const ids = levelBuckets.get(level) ?? [];
    const startX = ORIGIN_X - ((ids.length - 1) * HORIZONTAL_GAP) / 2;
    ids.forEach((id, idx) => xById.set(id, startX + idx * HORIZONTAL_GAP));
  }

  // Pull junction-like nodes toward the midpoint of their parents.
  for (let level = 1; level <= maxLevel; level++) {
    const ids = levelBuckets.get(level) ?? [];
    for (const id of ids) {
      const parents = (incoming.get(id) ?? []).filter((p) => (levels.get(p) ?? 0) === level - 1);
      if (parents.length < 2) continue;
      const avgParentX = parents.reduce((sum, p) => sum + (xById.get(p) ?? ORIGIN_X), 0) / parents.length;
      xById.set(id, avgParentX);
    }
  }

  // Resolve collisions and center each row around the same viewport center.
  for (let level = 0; level <= maxLevel; level++) {
    const ids = [...(levelBuckets.get(level) ?? [])];
    ids.sort((a, b) => (xById.get(a) ?? 0) - (xById.get(b) ?? 0));

    let cursor = Number.NEGATIVE_INFINITY;
    for (const id of ids) {
      const desired = xById.get(id) ?? ORIGIN_X;
      const placed = Math.max(desired, cursor + MIN_GAP);
      xById.set(id, placed);
      cursor = placed;
    }

    if (ids.length > 0) {
      const minX = xById.get(ids[0]) ?? ORIGIN_X;
      const maxX = xById.get(ids[ids.length - 1]) ?? ORIGIN_X;
      const midX = (minX + maxX) / 2;
      const shift = ORIGIN_X - midX;
      for (const id of ids) {
        xById.set(id, (xById.get(id) ?? ORIGIN_X) + shift);
      }
    }
  }

  return nodes.map((node) => {
    const level = levels.get(node.id) ?? 0;
    return {
      ...node,
      position: {
        x: xById.get(node.id) ?? ORIGIN_X,
        y: ORIGIN_Y + level * VERTICAL_GAP,
      },
    };
  });
}
