"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_SIM_OPTIONS,
  initialLayout,
  tick,
  totalMotion,
  type SimEdge,
  type SimNode,
} from "@/lib/crossrefs/force-sim";
import type { GraphEdge, GraphNode } from "@/lib/crossrefs/types";

/**
 * The desktop-only force-directed reference graph (ARCHITECTURE.md §4.7.1, `referenceGraph`
 * capability). Canvas rendering, not SVG or a DOM node per graph node — see `force-sim.ts` for
 * why that matters once a hub verse pulls in a hundred-plus neighbors.
 */

export interface DeepDiveGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  seedId: string;
  onSelect: (node: GraphNode) => void;
}

const TIER_ALPHA: Record<string, number> = { strong: 0.85, moderate: 0.55, light: 0.3 };
const TIER_WEIGHT: Record<string, number> = { strong: 1, moderate: 0.6, light: 0.3 };
const LABEL_FONT_SIZE = 12;
const LABEL_CAP = 6;

interface LabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
  textX: number;
  textY: number;
  text: string;
}

export function DeepDiveGraph({ nodes, edges, seedId, onSelect }: DeepDiveGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const drawRef = useRef<(() => void) | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const focusedIdRef = useRef<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 800, height: 520 });

  // Keyboard traversal order: the `nodes` PROP order (seed first, then descending degree, then
  // id ascending) — deliberately not simulation positions, which move every frame. An order
  // that shifts under the user mid-traversal is worse than no keyboard support at all.
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      if (a.id === seedId && b.id !== seedId) return -1;
      if (b.id === seedId && a.id !== seedId) return 1;
      if (b.degree !== a.degree) return b.degree - a.degree;
      return a.id.localeCompare(b.id);
    });
  }, [nodes, seedId]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Adjacency for the data table's "Links from here" column — an edge counts for both the
  // source and the target, since the reader wants "what touches this row", not a direction.
  const adjacency = useMemo(() => {
    const map = new Map<string, GraphEdge[]>();
    for (const e of edges) {
      if (!map.has(e.source)) map.set(e.source, []);
      map.get(e.source)!.push(e);
      if (e.target !== e.source) {
        if (!map.has(e.target)) map.set(e.target, []);
        map.get(e.target)!.push(e);
      }
    }
    return map;
  }, [edges]);

  function linksFromHere(node: GraphNode): string {
    const incident = adjacency.get(node.id) ?? [];
    const refs = incident
      .map((e) => (e.source === node.id ? e.target : e.source))
      .map((id) => nodeById.get(id)?.reference)
      .filter((v): v is string => Boolean(v));
    if (refs.length === 0) return "—";
    const shown = refs.slice(0, LABEL_CAP);
    const remaining = refs.length - shown.length;
    return remaining > 0 ? `${shown.join(", ")}, +${remaining} more` : shown.join(", ");
  }

  const liveMessage = useMemo(() => {
    if (!focusedId) return "";
    const index = sortedNodes.findIndex((n) => n.id === focusedId);
    const node = sortedNodes[index];
    if (!node) return "";
    const connections = `${node.degree} connection${node.degree === 1 ? "" : "s"}`;
    return `${node.reference}. ${connections}. ${index + 1} of ${sortedNodes.length}.`;
  }, [focusedId, sortedNodes]);

  // Respond to the container's own size, not the viewport — same discipline as `<PassageRenderer>`.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: Math.max(320, entry.contentRect.width), height: Math.max(320, entry.contentRect.height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Mirror the graph cursor into a ref `draw` can read every frame, and repaint immediately —
  // the animation loop stops once the layout settles, so a keyboard-only cursor move needs its
  // own repaint the same way pointer hover already gets one.
  useEffect(() => {
    focusedIdRef.current = focusedId;
    drawRef.current?.();
  }, [focusedId]);

  useEffect(() => {
    const opts = { ...DEFAULT_SIM_OPTIONS, width: size.width, height: size.height };
    const ids = nodes.map((n) => n.id);
    simNodesRef.current = initialLayout(ids, opts).map((n) => ({ ...n, fixed: n.id === seedId ? false : n.fixed }));

    const simEdges: SimEdge[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: TIER_WEIGHT[e.tier] ?? 0.5,
    }));

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let frames = 0;
    const nodeByIdLocal = new Map(nodes.map((n) => [n.id, n]));
    const style = getComputedStyle(document.documentElement);
    const colorBrand = style.getPropertyValue("--color-brand").trim() || "#4a7a6f";
    const colorRubric = style.getPropertyValue("--color-rubric").trim() || "#b3432b";
    const colorInk = style.getPropertyValue("--color-ink-muted").trim() || "#666";
    const colorInkStrong = style.getPropertyValue("--color-ink").trim() || "#222";
    const colorBorder = style.getPropertyValue("--color-border").trim() || "#ccc";
    const colorFocusRing = style.getPropertyValue("--color-focus-ring").trim() || "#b3432b";
    const colorBg = style.getPropertyValue("--color-bg").trim() || "#fff";
    // A canvas `font` string is parsed as CSS shorthand but resolved against no element, so
    // `var(--font-sans)` never resolves — the assignment is dropped and labels silently fall
    // back to the 10px sans-serif default. The variable has to be substituted here instead.
    const fontFamily =
      style.getPropertyValue("--font-sans").trim() || "system-ui, sans-serif";
    const labelFont = `${LABEL_FONT_SIZE}px ${fontFamily}`;

    // Nodes eligible for a label at all when they aren't the seed/hovered/cursor node: r > 10,
    // OR in the top third of nodes by degree. Computed once per layout (not per frame) from the
    // `nodes` prop, same stability discipline as the keyboard order.
    const sortedByDegree = [...nodes].sort((a, b) => b.degree - a.degree);
    const topBandSize = Math.max(1, Math.ceil(nodes.length / 3));
    const topBandIds = new Set(sortedByDegree.slice(0, topBandSize).map((n) => n.id));

    function measureLabelRect(sn: SimNode, r: number, text: string): LabelRect {
      const width = ctx!.measureText(text).width;
      const paddingX = 3;
      const paddingY = 2;
      const textX = sn.x + r + 4;
      const textY = sn.y + 4;
      return {
        x: textX - paddingX,
        y: textY - LABEL_FONT_SIZE - paddingY,
        width: width + paddingX * 2,
        height: LABEL_FONT_SIZE + paddingY * 2,
        textX,
        textY,
        text,
      };
    }

    function rectsOverlap(a: LabelRect, b: LabelRect) {
      return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }

    function drawLabelRect(rect: LabelRect) {
      ctx!.globalAlpha = 0.82;
      ctx!.fillStyle = colorBg;
      ctx!.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx!.globalAlpha = 1;
      ctx!.fillStyle = colorInkStrong;
      ctx!.font = labelFont;
      ctx!.fillText(rect.text, rect.textX, rect.textY);
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, size.width, size.height);
      const byId = new Map(simNodesRef.current.map((n) => [n.id, n]));

      // Edges first, under the nodes.
      for (const e of edges) {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = colorBorder;
        ctx.globalAlpha = TIER_ALPHA[e.tier] ?? 0.4;
        ctx.lineWidth = e.tier === "strong" ? 1.6 : 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const labelCandidates: { sn: SimNode; meta: GraphNode; r: number }[] = [];

      for (const sn of simNodesRef.current) {
        const meta = nodeByIdLocal.get(sn.id);
        if (!meta) continue;
        const isSeed = sn.id === seedId;
        const isHovered = sn.id === hoveredIdRef.current;
        const isCursor = sn.id === focusedIdRef.current;
        const r = isSeed ? 11 : Math.min(14, 5 + meta.degree * 1.4);

        ctx.beginPath();
        ctx.arc(sn.x, sn.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isSeed ? colorRubric : colorBrand;
        ctx.globalAlpha = isSeed ? 1 : 0.35 + Math.min(0.55, meta.degree * 0.08);
        ctx.fill();
        if (isHovered) {
          ctx.globalAlpha = 1;
          ctx.lineWidth = 2;
          ctx.strokeStyle = colorInk;
          ctx.stroke();
        }
        if (isCursor) {
          ctx.globalAlpha = 1;
          ctx.lineWidth = 3;
          ctx.strokeStyle = colorFocusRing;
          ctx.beginPath();
          ctx.arc(sn.x, sn.y, r + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        labelCandidates.push({ sn, meta, r });
      }

      // Label pass: the cursor, seed and hovered node are always drawn (their rects are pushed
      // first so they win); the rest is a greedy overlap-rejection pass over the eligible,
      // degree-ranked remainder.
      ctx.font = labelFont;
      const placedRects: LabelRect[] = [];
      const candidateById = new Map(labelCandidates.map((c) => [c.sn.id, c]));
      const alwaysOrder = [focusedIdRef.current, seedId, hoveredIdRef.current].filter(
        (id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index,
      );
      for (const id of alwaysOrder) {
        const c = candidateById.get(id);
        if (!c) continue;
        const rect = measureLabelRect(c.sn, c.r, c.meta.reference);
        placedRects.push(rect);
        drawLabelRect(rect);
      }

      const alwaysIds = new Set(alwaysOrder);
      const remainder = labelCandidates
        .filter((c) => !alwaysIds.has(c.sn.id))
        .filter((c) => c.r > 10 || topBandIds.has(c.sn.id))
        .sort((a, b) => b.meta.degree - a.meta.degree || a.sn.id.localeCompare(b.sn.id));

      for (const c of remainder) {
        const rect = measureLabelRect(c.sn, c.r, c.meta.reference);
        if (placedRects.some((p) => rectsOverlap(p, rect))) continue;
        placedRects.push(rect);
        drawLabelRect(rect);
      }
    }

    drawRef.current = draw;

    function step() {
      tick(simNodesRef.current, simEdges, opts);
      draw();
      frames++;
      // Stop animating once the layout settles or after a generous ceiling, so an idle deep
      // dive doesn't spin the CPU forever. Hover highlighting after settling is repainted
      // directly by `handlePointerMove` via `drawRef`, not by restarting this loop.
      if (frames < 400 && totalMotion(simNodesRef.current) > 0.05) {
        raf = requestAnimationFrame(step);
      }
    }
    raf = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf);
  }, [nodes, edges, seedId, size]);

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let closest: string | null = null;
    let closestDist = Infinity;
    for (const n of simNodesRef.current) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < closestDist) {
        closestDist = d;
        closest = n.id;
      }
    }
    const next = closestDist < 16 ? closest : null;
    if (next !== hoveredIdRef.current) {
      hoveredIdRef.current = next;
      setHoveredId(next);
      drawRef.current?.();
    }
  }

  function handleClick() {
    if (!hoveredId) return;
    const node = nodes.find((n) => n.id === hoveredId);
    if (node) onSelect(node);
  }

  function moveCursorTo(index: number) {
    if (sortedNodes.length === 0) return;
    const clamped = Math.max(0, Math.min(sortedNodes.length - 1, index));
    const node = sortedNodes[clamped];
    if (node) setFocusedId(node.id);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    if (sortedNodes.length === 0) return;
    const currentIndex = focusedId ? sortedNodes.findIndex((n) => n.id === focusedId) : -1;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
      case "n":
        e.preventDefault();
        moveCursorTo(currentIndex < 0 ? 0 : currentIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        moveCursorTo(currentIndex < 0 ? 0 : currentIndex - 1);
        break;
      case "Home":
        e.preventDefault();
        moveCursorTo(0);
        break;
      case "End":
        e.preventDefault();
        moveCursorTo(sortedNodes.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedId) {
          const node = nodeById.get(focusedId);
          if (node) onSelect(node);
        }
        break;
      case "Escape":
        e.preventDefault();
        setFocusedId(null);
        break;
      default:
        break;
    }
  }

  return (
    <>
      <div ref={containerRef} className="deep-dive-graph">
        <canvas
          ref={canvasRef}
          className="deep-dive-graph__canvas"
          tabIndex={0}
          role="application"
          aria-roledescription="Cross-reference graph"
          aria-label={`Force-directed rendering of ${nodes.length} passages and ${edges.length} cross-reference links. Use arrow keys to move between passages, Enter to open one. The same data is available as a table below.`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => {
            hoveredIdRef.current = null;
            setHoveredId(null);
            drawRef.current?.();
          }}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        />
        {hoveredId && (
          <p className="deep-dive-graph__hint" aria-hidden="true">
            {nodes.find((n) => n.id === hoveredId)?.reference} — click to open
          </p>
        )}

        <div className="deep-dive-graph__live" aria-live="polite">
          {liveMessage}
        </div>

        {/* The graph encodes four things visually and, without this, says none of them out
            loud: a reader cannot tell whether a big node means "important" or "arbitrary".
            `aria-hidden` because the canvas itself already carries a text description and the
            legend only explains marks a screen reader never receives. */}
        <dl className="deep-dive-graph__legend" aria-hidden="true">
          <div className="deep-dive-graph__legend-item">
            <span className="deep-dive-graph__key deep-dive-graph__key--seed" />
            <dt>This passage</dt>
          </div>
          <div className="deep-dive-graph__legend-item">
            <span className="deep-dive-graph__key deep-dive-graph__key--node" />
            <dt>Linked passage</dt>
            <dd>larger and more solid the more connections it has here</dd>
          </div>
          <div className="deep-dive-graph__legend-item">
            <span className="deep-dive-graph__key deep-dive-graph__key--edge" />
            <dt>Cross-reference</dt>
            <dd>heavier the more votes the link has</dd>
          </div>
        </dl>
      </div>

      {/* The canvas can never expose its data to a screen reader or a search-in-page. This is
          the same graph, always in the accessible tree, collapsed by default so it doesn't
          compete with the visualization but still discoverable and printable. */}
      <details className="deep-dive-graph__data">
        <summary>
          Graph data as a table ({nodes.length} passage{nodes.length === 1 ? "" : "s"}, {edges.length} link
          {edges.length === 1 ? "" : "s"})
        </summary>
        <div className="deep-dive-graph__table-wrap">
          <table className="deep-dive-graph__table">
            <caption>
              Every passage in this cross-reference graph, how many connections it has here, and which
              passages it links to.
            </caption>
            <thead>
              <tr>
                <th scope="col">Passage</th>
                <th scope="col">Connections</th>
                <th scope="col">Links from here</th>
              </tr>
            </thead>
            <tbody>
              {sortedNodes.map((node) => (
                <tr key={node.id}>
                  <th scope="row">
                    <button type="button" className="deep-dive-graph__table-button" onClick={() => onSelect(node)}>
                      {node.reference}
                    </button>
                  </th>
                  <td>{node.degree}</td>
                  <td>{linksFromHere(node)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
