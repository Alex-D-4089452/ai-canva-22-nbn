/**
 * Pure placement helpers for dropping a NEW box onto the canvas.
 *
 * A box added from the palette or the canvas rail has no position of its own,
 * so it lands in the middle of what the user is currently looking at — the
 * flow-space centre of the visible viewport, which Canvas publishes into
 * uiStore (`readViewportCenter`). Everything here is pure so the maths is
 * testable without a mounted React Flow instance: Canvas only reports the
 * viewport transform + pane size, boardStore only passes nodes + a box size.
 */

import type { Rect } from "./areas.js";

export interface Point {
  x: number;
  y: number;
}

/** Size of the box about to be added (BOX_TYPES[type].defaultWidth/Height). */
export interface Size {
  width: number;
  height: number;
}

/** Minimal shape of a board node — a React Flow `Node` satisfies it. */
export interface PlaceableNode {
  type?: string;
  position: Point;
  style?: { width?: number | string; height?: number | string } | null;
}

/** Flow-space breathing room kept between a new box and its neighbours. */
const GAP = 16;

/** Ring radius of the nearest-free-slot search (±2 box-sized tiles). */
const RINGS = 2;

/**
 * Flow-space point at the centre of the visible pane, derived from React Flow's
 * viewport transform `[translateX, translateY, zoom]` and the pane's pixel
 * size. Screen = flow * zoom + translate, so flow = (screen − translate) / zoom.
 */
export function viewportCenter(
  transform: readonly [number, number, number],
  width: number,
  height: number
): Point {
  const [tx, ty, zoom] = transform;
  const z = zoom || 1;
  return { x: (width / 2 - tx) / z, y: (height / 2 - ty) / z };
}

/**
 * Where to drop a new box of `size`: centred on `center`, then — if it would
 * cover a box already on the board — moved to the NEAREST free slot on a grid
 * of box-sized tiles around that centre (right first, then down — reading
 * order), so repeatedly adding boxes fans them out instead of stacking them
 * invisibly on top of each other. Areas are ignored: they are background a box
 * is meant to sit on.
 *
 * Returns null when the viewport centre is unknown (no canvas has reported one
 * yet — e.g. code running before mount); the caller falls back to its old
 * fixed top-left placement.
 */
export function placeNewBox(
  nodes: PlaceableNode[],
  center: Point | null,
  size: Size
): Point | null {
  if (!center) return null;
  const origin = { x: center.x - size.width / 2, y: center.y - size.height / 2 };
  const stepX = size.width + GAP;
  const stepY = size.height + GAP;
  for (const tile of freeSlotOrder()) {
    const candidate = { x: origin.x + tile.x * stepX, y: origin.y + tile.y * stepY };
    if (!coversAnotherBox(nodes, candidate, size)) return candidate;
  }
  // The board is packed around the centre — land on the far tile anyway.
  return { x: origin.x + RINGS * stepX, y: origin.y + RINGS * stepY };
}

/** Tile offsets (in box-sized steps) around the centre, nearest first. */
function freeSlotOrder(): Point[] {
  const tiles: Point[] = [];
  for (let i = -RINGS; i <= RINGS; i++)
    for (let j = -RINGS; j <= RINGS; j++) tiles.push({ x: i, y: j });
  // Nearest first; among equal distances prefer right, then down (reading
  // order), so the fan grows away from the left-hand palette instead of
  // off-screen left.
  return tiles.sort(
    (a, b) =>
      a.x * a.x + a.y * a.y - (b.x * b.x + b.y * b.y) ||
      slotPreference(a) - slotPreference(b)
  );
}

/** Right scores lowest, then down; up and left (the palette side) highest. */
function slotPreference(p: Point): number {
  return (p.x < 0 ? 8 : 0) + (p.y < 0 ? 4 : 0) + (p.y > 0 ? 2 : 0) + (p.x > 0 ? 1 : 0);
}

/** True when the new box would (near-)cover a node already on the board. */
export function coversAnotherBox(
  nodes: PlaceableNode[],
  position: Point,
  size: Size
): boolean {
  const next: Rect = { x: position.x, y: position.y, width: size.width, height: size.height };
  return nodes.some((n) => {
    if (n.type === "area") return false; // background — sit on it freely
    const rect: Rect = {
      x: n.position.x,
      y: n.position.y,
      width: Number(n.style?.width) || 0,
      height: Number(n.style?.height) || 0,
    };
    return intersects(next, rect);
  });
}

/** Two rects that overlap (or come within the gap) count as colliding. */
function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width + GAP &&
    b.x < a.x + a.width + GAP &&
    a.y < b.y + b.height + GAP &&
    b.y < a.y + a.height + GAP
  );
}
