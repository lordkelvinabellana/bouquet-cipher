"use client";
/**
 * The animated bouquet. Elements are never redrawn once placed (layout v1's stability
 * rule), so each one mounts once and grows in; removed ones linger as "ghosts" while they
 * wilt. The only movement is a tier of stems turning to keep its fan even, which glides.
 * The view zooms out immediately when the bouquet outgrows the card, and zooms back in
 * and rebalances only after typing pauses, so it never bobs while you type.
 */
import { memo, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { animate, glidePose, growIn, growStem, retractStem, samePose, tagDrop, wiltOut, wrapIn, wrapOut, type Pose, type WrapPart } from "@/anim/grow";
import { FRAME } from "@/core/art/scenery";
import { SHARE_FRAME, type TagOptions } from "@/core/art/tag";
import type { Pt } from "@/core/art/geom";
import type { Shape } from "@/core/art/types";
import { gatherBouquet } from "@/core/layout/v1/gather";
import type { BouquetLayout, PlacedElement, PlacedStem } from "@/core/layout/v1/layout";
import {
  backdropGroups,
  cameraMatrix,
  fitsCamera,
  growingCamera,
  knotOf,
  presentedCamera,
  RIBBON_SCALE,
  ribbonGroups,
  sproutShapes,
  stemShapesFor,
  tagGroups,
  TIE,
  wrapGroups,
  type Camera,
} from "@/core/scene/scene";
import { Grain } from "./Grain";
import { Labels } from "./Labels";
import { matrix } from "./matrix";
import { Paths } from "./Paths";

const elementId = (e: PlacedElement) => `${e.key}|${e.g}|${e.local.map((n) => n.toFixed(2)).join(",")}`;
const stemId = (s: PlacedStem) => `${s.ordinal}|${s.curve.theta.toFixed(4)}|${s.curve.kappa.toFixed(6)}`;


/** Decides, at mount time, whether a newcomer should grow in, and with what stagger delay. */
interface Growth {
  /** Returns a delay in seconds, or null to appear without animating. */
  next(): number | null;
  reduced: boolean;
}

/**
 * When a stem moves as one piece (its tier turning to keep the fan even, or the bunch
 * gathering for wrapping), glide it there instead of jumping. Returns a ref for a wrapper
 * <g> around a drawing that's already at its new place.
 */
function usePose(swing: number, shift: Pt, reduced: boolean) {
  const node = useRef<SVGGElement>(null);
  const shown = useRef<Pose>({ swing, shift });
  const [x, y] = shift;
  useLayoutEffect(() => {
    const to: Pose = { swing, shift: [x, y] };
    const from = shown.current;
    if (!node.current || samePose(from, to)) {
      shown.current = to;
      return;
    }
    return glidePose(node.current, from, to, reduced, (p) => (shown.current = p));
  }, [swing, x, y, reduced]);
  return node;
}

const samePlace = (a: PlacedElement, b: PlacedElement) => a.swing === b.swing && a.shift[0] === b.shift[0] && a.shift[1] === b.shift[1];

const ElementG = memo(
  function ElementG({ el, growth }: { el: PlacedElement; growth: Growth }) {
    const inner = useRef<SVGGElement>(null);
    const swing = usePose(el.swing, el.shift, growth.reduced);
    useLayoutEffect(() => {
      const delay = growth.next();
      if (delay === null || !inner.current) return;
      return growIn(inner.current, el.kind, delay, growth.reduced);
      // mount only: an element's drawing never changes while it keeps its id
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <g ref={swing}>
        <g transform={matrix(el.m)} data-key={el.key}>
          <g ref={inner}>
            <Paths shapes={el.art.shapes} />
          </g>
        </g>
      </g>
    );
  },
  (a, b) => a.el.key === b.el.key && samePlace(a.el, b.el) && a.growth === b.growth,
);

function GhostElement({ el, reduced, onDone }: { el: PlacedElement; reduced: boolean; onDone: () => void }) {
  const inner = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    if (!inner.current) return;
    return wiltOut(inner.current, reduced, onDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <g transform={matrix(el.m)}>
      <g ref={inner}>
        <Paths shapes={el.art.shapes} />
      </g>
    </g>
  );
}

function StemG({ stem, zoom, growth }: { stem: PlacedStem; zoom: number; growth: Growth }) {
  const node = useRef<SVGGElement>(null);
  const swing = usePose(stem.swing, stem.shift, growth.reduced);
  useLayoutEffect(() => {
    if (growth.next() === null || !node.current) return;
    return growStem(node.current, growth.reduced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shapes = useMemo(() => stemShapesFor(stem, zoom), [stem, zoom]);
  return (
    <g ref={swing}>
      <g ref={node}>
        <Paths shapes={shapes} />
      </g>
    </g>
  );
}

function GhostStem({ stem, zoom, reduced, onDone }: { stem: PlacedStem; zoom: number; reduced: boolean; onDone: () => void }) {
  const node = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    if (!node.current) return;
    return retractStem(node.current, reduced, onDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <g ref={node}>
      <Paths shapes={stemShapesFor(stem, zoom)} />
    </g>
  );
}

interface Ghost<T> {
  id: string;
  item: T;
}

/** Keep removed things around until their exit animation calls back. */
function useGhosts<T>(items: readonly T[], idOf: (t: T) => string, enabled: boolean) {
  const prev = useRef<Map<string, T>>(new Map());
  const counter = useRef(0);
  const [ghosts, setGhosts] = useState<Ghost<T>[]>([]);
  useLayoutEffect(() => {
    const next = new Map(items.map((t) => [idOf(t), t]));
    const gone: Ghost<T>[] = [];
    if (enabled) {
      for (const [id, t] of prev.current) if (!next.has(id)) gone.push({ id: `${id}#${counter.current++}`, item: t });
    }
    prev.current = next;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (gone.length) setGhosts((g) => [...g, ...gone]);
  }, [items, idOf, enabled]);
  const release = useCallback((id: string) => setGhosts((g) => g.filter((x) => x.id !== id)), []);
  return { ghosts, release };
}

/**
 * Animate the camera. While writing: zoom out right away when the bouquet outgrows the
 * view, but zoom back in and rebalance only after typing pauses. Moving to a new place
 * (wrapping, which centres the bouquet) glides at once.
 */
function useCamera(target: Camera, reduced: boolean, fits: (c: Camera) => boolean) {
  const node = useRef<SVGGElement>(null);
  const current = useRef(target);
  const [initial] = useState(() => matrix(cameraMatrix(target)));
  useLayoutEffect(() => {
    const g = node.current;
    if (!g) return;
    const from = current.current;
    const apply = (c: Camera) => {
      current.current = c;
      g.setAttribute("transform", matrix(cameraMatrix(c)));
    };
    const moved = Math.abs(from.x - target.x) > 0.5 || Math.abs(from.y - target.y) > 0.5;
    const turned = Math.abs(from.angle - target.angle) > 0.05;
    const dz = target.zoom - from.zoom;
    if (!moved && !turned && Math.abs(dz) <= 0.002) return;
    let stop: (() => void) | undefined;
    const go = () => {
      const start = current.current;
      if (reduced || document.hidden) return apply(target);
      const c = animate(0, 1, {
        type: "spring",
        stiffness: moved ? 90 : 110,
        damping: 22,
        onUpdate: (t) =>
          apply({
            zoom: start.zoom + (target.zoom - start.zoom) * t,
            x: start.x + (target.x - start.x) * t,
            y: start.y + (target.y - start.y) * t,
            angle: start.angle + (target.angle - start.angle) * t,
          }),
      });
      const safety = setTimeout(() => {
        c.stop();
        apply(target);
      }, 1600);
      stop = () => {
        clearTimeout(safety);
        c.stop();
      };
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    // settle once typing pauses, unless the bouquet no longer fits the view as shown
    if (!moved && dz >= -0.002 && fits(from)) timer = setTimeout(go, 800);
    else go();
    return () => {
      clearTimeout(timer);
      stop?.();
    };
  }, [target, reduced, fits]);
  return { node, initial };
}

/**
 * Newcomers after the first render grow in; ones arriving together (a paste) are
 * staggered, capped so it never drags on. Children run their mount effects before this
 * component's own, so everything present at first render simply appears.
 */
function useGrowth(enabled: boolean, reduced: boolean): Growth {
  const live = useRef(false);
  const clock = useRef({ t: -1e9, n: 0 });
  useLayoutEffect(() => {
    live.current = true;
  }, []);
  return useMemo(
    () => ({
      reduced,
      next: () => {
        if (!enabled || !live.current) return null;
        const now = performance.now();
        const c = clock.current;
        if (now - c.t > 80) c.n = 0;
        c.t = now;
        return Math.min(c.n++ * 0.035, 1.2);
      },
    }),
    [enabled, reduced],
  );
}

export type WrapState = "wrapping" | "wrapped" | "unwrapping";

/** One sheet of wrapping paper; folds in when it mounts wrapping, swings away when unwrapping. */
function WrapLayer({ shapes, part, state, reduced, onDone }: { shapes: Shape[]; part: WrapPart; state: WrapState; reduced: boolean; onDone?: () => void }) {
  const node = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    if (!node.current) return;
    if (state === "wrapping") return wrapIn(node.current, part, reduced);
    if (state === "unwrapping") return wrapOut(node.current, part, reduced, () => onDone?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, part, reduced]);
  return (
    <g ref={node}>
      <Paths shapes={shapes} />
    </g>
  );
}

/** The gift tag and its string, dropping in from the ribbon. */
function TagLayer({ tag, knot, reduced }: { tag: TagOptions; knot: readonly [number, number]; reduced: boolean }) {
  const node = useRef<SVGGElement>(null);
  const [kx, ky] = knot;
  const groups = useMemo(
    () => tagGroups({ url: tag.url, code: tag.code, toName: tag.toName, fromName: tag.fromName }, [kx, ky]),
    [tag.url, tag.code, tag.toName, tag.fromName, kx, ky],
  );
  useLayoutEffect(() => {
    if (!node.current) return;
    return tagDrop(node.current, [kx, ky], reduced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <g ref={node}>
      {groups.map((g) => (
        <g key={g.key} transform={matrix(g.m)}>
          <Paths shapes={g.shapes} />
          {g.labels ? <Labels labels={g.labels} /> : null}
        </g>
      ))}
    </g>
  );
}

export interface LiveBouquetProps {
  /** The open bouquet (it's gathered here while wrapped). */
  layout: BouquetLayout;
  /** Show the wax seal with this signature. */
  seal?: number;
  /** The seal's wax colour and emblem ("gold/heart"), if the sender chose one. */
  sealStyle?: string | null;
  ribbonSeed?: number;
  /** Animate elements as they appear (off for a bouquet that should just be there). */
  grow?: boolean;
  /** Element key to glow (used by the reveal). */
  glow?: string | null;
  /** Show only elements whose text index is below this (used by the growth replay). */
  hideFrom?: number;
  /** Wrapping paper, and whether it's folding in, sitting still or coming off. */
  wrap?: { paper: number; state: WrapState } | null;
  /** Called once the paper has finished coming off. */
  onUnwrapped?: () => void;
  /** Hang the gift tag below the card: the picture becomes the taller share frame. */
  tag?: TagOptions | null;
  /** Centre the whole bouquet in the oval (wrapped); otherwise it grows up from the tie. */
  present?: boolean;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}

export function LiveBouquet({
  layout: open,
  seal,
  sealStyle = null,
  ribbonSeed = 7,
  grow = true,
  glow,
  hideFrom,
  wrap,
  onUnwrapped,
  tag,
  present = false,
  className,
  style,
  label,
}: LiveBouquetProps) {
  const reduced = useReducedMotion() ?? false;
  // wrapped, the stems are gathered into a bunch (they glide there, and back when unwrapped)
  const wrapped = wrap != null;
  const layout = useMemo(() => (wrapped ? gatherBouquet(open) : open), [open, wrapped]);
  const camera = useMemo(() => (present ? presentedCamera(layout) : growingCamera(layout)), [layout, present]);
  const zoom = camera.zoom;
  const fits = useCallback((c: Camera) => fitsCamera(layout, c), [layout]);
  const { node: cameraNode, initial: cameraInitial } = useCamera(camera, reduced, fits);
  const growth = useGrowth(grow, reduced);

  const visible = useMemo(
    () => (hideFrom === undefined ? layout.elements : layout.elements.filter((e) => e.index < hideFrom)),
    [layout.elements, hideFrom],
  );
  const visibleStems = useMemo(
    () => (hideFrom === undefined ? layout.stems : layout.stems.filter((s) => visible.some((e) => e.stem === s.ordinal))),
    [layout.stems, visible, hideFrom],
  );

  const el = useGhosts(visible, elementId, grow);
  const st = useGhosts(visibleStems, stemId, grow);

  const leaves = visible.filter((e) => e.kind !== "bloom");
  const blooms = visible.filter((e) => e.kind === "bloom");
  const ghostLeaves = el.ghosts.filter((g) => g.item.kind !== "bloom");
  const ghostBlooms = el.ghosts.filter((g) => g.item.kind === "bloom");
  const glowing = glow ? visible.find((e) => e.key === glow) : undefined;

  const backdrop = useMemo(() => backdropGroups(false), []);
  const front = useMemo(() => ribbonGroups({ seal, ribbonSeed, sealStyle }), [seal, ribbonSeed, sealStyle]);
  const grainId = useId().replace(/:/g, "");
  const paper = wrap?.paper ?? null;
  const sheets = useMemo(() => (paper === null ? null : wrapGroups(layout, paper, zoom, ribbonSeed + 101)), [layout, paper, zoom, ribbonSeed]);
  const height = tag ? SHARE_FRAME.h : FRAME.h;

  return (
    <svg viewBox={`0 0 ${FRAME.w} ${height}`} className={className} style={style} role="img" aria-label={label ?? "A bouquet"}>
      {backdrop.map((g, i) => (
        <Paths key={i} shapes={g.shapes} />
      ))}
      <g ref={cameraNode} transform={cameraInitial}>
        {sheets && wrap ? <WrapLayer shapes={sheets.back} part="back" state={wrap.state} reduced={reduced} onDone={onUnwrapped} /> : null}
        <g>
          {st.ghosts.map((g) => (
            <GhostStem key={g.id} stem={g.item} zoom={zoom} reduced={reduced} onDone={() => st.release(g.id)} />
          ))}
          {visibleStems.map((s) => (
            <StemG key={stemId(s)} stem={s} zoom={zoom} growth={growth} />
          ))}
          {layout.sprout && hideFrom === undefined ? <Paths shapes={sproutShapes(layout.sprout, zoom)} /> : null}
        </g>
        {sheets && wrap ? (
          <>
            <WrapLayer shapes={sheets.frontLeft} part="left" state={wrap.state} reduced={reduced} />
            <WrapLayer shapes={sheets.frontRight} part="right" state={wrap.state} reduced={reduced} />
          </>
        ) : null}
        <g>
          {ghostLeaves.map((g) => (
            <GhostElement key={g.id} el={g.item} reduced={reduced} onDone={() => el.release(g.id)} />
          ))}
          {leaves.map((e) => (
            <ElementG key={elementId(e)} el={e} growth={growth} />
          ))}
        </g>
        <g>
          {ghostBlooms.map((g) => (
            <GhostElement key={g.id} el={g.item} reduced={reduced} onDone={() => el.release(g.id)} />
          ))}
          {blooms.map((e) => (
            <ElementG key={elementId(e)} el={e} growth={growth} />
          ))}
        </g>
        {glowing ? (
          <g pointerEvents="none">
            {[1.9, 1.45, 1.1].map((k, i) => (
              <circle key={i} cx={glowing.focus[0]} cy={glowing.focus[1]} r={glowing.hit.r * k} fill="#FFF6DA" opacity={0.22 + i * 0.1} />
            ))}
          </g>
        ) : null}
        {/* the ribbon rides with the camera but keeps its own size, and stays level */}
        <g transform={`rotate(${-camera.angle}) scale(${(RIBBON_SCALE / zoom).toFixed(4)}) translate(${-TIE[0]} ${-TIE[1]})`}>
          {front.map((g) => (
            <Paths key={g.key} shapes={g.shapes} />
          ))}
        </g>
      </g>
      <Grain id={grainId} />
      {tag ? <TagLayer tag={tag} knot={knotOf(camera)} reduced={reduced} /> : null}
    </svg>
  );
}
