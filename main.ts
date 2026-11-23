// The World in One Day — Sunday, 22 November 2026.
// A deterministic newspaper front page drawn in pure Node (standard library only).
// Writes one 1024x1024 PNG to MAKEFUN_OUTPUT_DIR/entry.png (default /output).
// No network, no clock, no randomness: two runs produce identical bytes.
//
// Usage: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

// ---- palette: newsprint on cream paper, one red accent ----
const PAPER: RGB = [246, 241, 229];
const PANEL: RGB = [238, 231, 214];
const INK: RGB = [24, 22, 18];
const RED: RGB = [163, 31, 31];
const BLUE: RGB = [31, 58, 95];
const GREY: RGB = [112, 106, 92];
const SKY: RGB = [203, 226, 238];
const GREEN: RGB = [74, 124, 89];
const ORANGE: RGB = [214, 110, 40];
const GOLD: RGB = [201, 162, 39];
const BROWN: RGB = [122, 84, 52];

// ---- raster canvas (RGB, row-major) ----
const px = new Uint8Array(W * H * 3);

function fillCanvas(c: RGB): void {
  for (let i = 0; i < px.length; i += 3) {
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
  }
}

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) setPx(i, j, c);
  }
}

function hline(x: number, y: number, w: number, c: RGB): void {
  rect(x, y, w, 1, c);
}

function vline(x: number, y: number, h: number, c: RGB): void {
  rect(x, y, 1, h, c);
}

function frame(x: number, y: number, w: number, h: number, c: RGB, t = 2): void {
  rect(x, y, w, t, c);
  rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c);
  rect(x + w - t, y, t, h, c);
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) setPx(cx + x, cy + y, c);
    }
  }
}

function ring(cx: number, cy: number, r: number, c: RGB, t = 2): void {
  for (let a = 0; a < 360; a++) {
    const th = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      setPx(Math.round(cx + (r - k) * Math.cos(th)), Math.round(cy + (r - k) * Math.sin(th)), c);
    }
  }
}

function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.max(0, Math.min(x0, x1, x2));
  const maxX = Math.min(W - 1, Math.max(x0, x1, x2));
  const minY = Math.max(0, Math.min(y0, y1, y2));
  const maxY = Math.min(H - 1, Math.max(y0, y1, y2));
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
      const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
      const cc = 1 - a - b;
      if (a >= 0 && b >= 0 && cc >= 0) setPx(x, y, c);
    }
  }
}

// ---- 5x7 bitmap font, each glyph 7 rows of 5 bits (MSB = left column) ----
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  a: [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  b: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x1e],
  c: [0x00, 0x00, 0x0e, 0x10, 0x10, 0x11, 0x0e],
  d: [0x01, 0x01, 0x0f, 0x11, 0x11, 0x11, 0x0f],
  e: [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  f: [0x06, 0x09, 0x08, 0x1e, 0x08, 0x08, 0x08],
  g: [0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  h: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x11],
  i: [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  j: [0x02, 0x00, 0x06, 0x02, 0x02, 0x12, 0x0c],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0x00, 0x00, 0x1a, 0x15, 0x15, 0x15, 0x15],
  n: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x11, 0x11],
  o: [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  p: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x1e, 0x10],
  q: [0x00, 0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01],
  r: [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10],
  s: [0x00, 0x00, 0x0f, 0x10, 0x0e, 0x01, 0x1e],
  t: [0x08, 0x08, 0x1c, 0x08, 0x08, 0x09, 0x06],
  u: [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0d],
  v: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04],
  w: [0x00, 0x00, 0x11, 0x15, 0x15, 0x15, 0x0a],
  x: [0x00, 0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11],
  y: [0x00, 0x00, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  z: [0x00, 0x00, 0x1f, 0x02, 0x04, 0x08, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  ',': [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  ':': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
  ';': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
  '-': [0x00, 0x00, 0x00, 0x0e, 0x00, 0x00, 0x00],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  '%': [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  '+': [0x00, 0x04, 0x04, 0x0e, 0x04, 0x04, 0x00],
  '=': [0x00, 0x00, 0x0e, 0x00, 0x0e, 0x00, 0x00],
  '?': [0x0e, 0x11, 0x01, 0x06, 0x04, 0x00, 0x04],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  '"': [0x0a, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00],
  '—': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  '–': [0x00, 0x00, 0x00, 0x0e, 0x00, 0x00, 0x00],
  '·': [0x00, 0x00, 0x04, 0x0e, 0x0e, 0x04, 0x00],
  '°': [0x0c, 0x12, 0x12, 0x0c, 0x00, 0x00, 0x00],
  '×': [0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x00],
};

function glyph(ch: string): number[] {
  if (ch === ' ') return [0, 0, 0, 0, 0, 0, 0];
  return FONT[ch] ?? FONT['?'];
}

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}

function drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const rows = glyph(ch);
  for (let r = 0; r < 7; r++) {
    const bits = rows[r];
    for (let col = 0; col < 5; col++) {
      if ((bits >> (4 - col)) & 1) {
        rect(x + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}

function drawText(x: number, y: number, s: string, scale: number, c: RGB): number {
  let cx = x;
  for (const ch of s) {
    drawChar(cx, y, ch, scale, c);
    cx += 6 * scale;
  }
  return cx - x;
}

function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

// Greedy word wrap; returns lines that fit maxWidthPx at the given scale.
function wrapText(s: string, scale: number, maxWidthPx: number): string[] {
  const maxChars = Math.max(1, Math.floor(maxWidthPx / (6 * scale)));
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur === '') {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

function drawPara(x: number, y: number, s: string, scale: number, c: RGB, maxWidthPx: number, lineH: number): number {
  const lines = wrapText(s, scale, maxWidthPx);
  for (let i = 0; i < lines.length; i++) {
    drawText(x, y + i * lineH, lines[i], scale, c);
  }
  return y + lines.length * lineH;
}

// ---- the day's news: Sunday, 22 November 2026 ----
// Sources: CNN, AP, Reuters, AFP, The Times, The Wall Street Journal,
// The Straits Times, IPS — all reporting events of 22 November 2026.

interface Story {
  kicker: string;
  head: string[];
  stand: string;
  icon: string;
}

const LEAD: Story = {
  kicker: 'CLIMATE · ANTALYA, TURKEY',
  head: ['COP31 COLLAPSES', 'WITH NO DEAL AT ALL'],
  stand:
    'Nearly 200 nations end the longest climate summit on record without an agreement, after the European Union and others reject a final text that never mentions fossil fuels.',
  icon: 'globe',
};

const GRID: Story[] = [
  {
    kicker: 'WAR IN UKRAINE · KYIV REGION',
    head: ['RUSSIAN DRONE HITS', 'BLOCK; 14 MISSING'],
    stand:
      'A Russian drone strike partly collapses a five-storey apartment block near Kyiv on Sunday morning. Rescuers search the rubble for at least 14 people.',
    icon: 'flats',
  },
  {
    kicker: 'MIDDLE EAST · BAHRAIN',
    head: ['IRAN STRIKE HITS', 'BAHRAIN; TWO HURT'],
    stand:
      'Bahrain says an Iranian attack struck a civilian industrial site in Sitra. Saudi Arabia, Kuwait and Qatar condemn the strike as Gulf tensions rise.',
    icon: 'derrick',
  },
  {
    kicker: 'DISASTER · INDONESIA',
    head: ['FACTORY FIRE: 3 DEAD,', 'DOZENS STILL MISSING'],
    stand:
      'A blaze sweeps a candy factory in Cikande, west Java. Rescuers search the ruins for 36 workers still missing.',
    icon: 'factory',
  },
  {
    kicker: 'ASIA · SEOUL',
    head: ['KOREA MINISTER QUITS', 'OVER AI CHEAT SCANDAL'],
    stand:
      'Education minister Choi Kyo-jin resigns on Sunday, days before the college entrance exams, after an AI cheating scandal.',
    icon: 'cap',
  },
  {
    kicker: 'UNITED STATES',
    head: ['FBI PROBES HACK OF', 'CRIME DATABASE'],
    stand:
      'The bureau investigates an apparent breach of the NCIC system used for warrants, fugitives and criminal-history checks.',
    icon: 'shield',
  },
];

// ---- small code-drawn illustrations (no downloaded images) ----

function smoke(x: number, y: number, c: RGB): void {
  disc(x, y, 7, c);
  disc(x + 12, y - 8, 9, c);
  disc(x + 26, y - 14, 11, c);
}

function flames(x: number, y: number, s: number): void {
  fillTriangle(x, y, x + 10 * s, y - 16 * s, x + 20 * s, y, ORANGE);
  fillTriangle(x + 12 * s, y, x + 20 * s, y - 12 * s, x + 28 * s, y, GOLD);
  fillTriangle(x + 22 * s, y, x + 30 * s, y - 15 * s, x + 38 * s, y, ORANGE);
}

function drawIcon(kind: string, x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, PANEL);
  frame(x, y, w, h, INK, 2);
  if (kind === 'globe') {
    // A warming world: globe, rising thermometer, cracked earth.
    const cx = x + 92;
    const cy = y + 96;
    const r = 58;
    disc(cx, cy, r, SKY);
    ring(cx, cy, r, INK, 3);
    const chord = (dy: number): number => Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    for (const dy of [-28, 0, 28]) {
      const hc = chord(dy);
      hline(cx - hc, cy + dy, hc * 2, BLUE);
    }
    for (const dx of [-28, 28]) {
      const vc = chord(dx);
      vline(cx + dx, cy - vc, vc * 2, BLUE);
    }
    disc(cx - 22, cy - 18, 13, GREEN);
    disc(cx + 24, cy + 12, 16, GREEN);
    disc(cx - 4, cy + 30, 9, GREEN);
    // Thermometer, mercury high.
    const tx = x + 218;
    rect(tx, y + 40, 18, 118, PAPER);
    frame(tx, y + 40, 18, 118, INK, 2);
    rect(tx + 3, y + 62, 12, 93, RED);
    disc(tx + 9, y + 158, 16, RED);
    ring(tx + 9, y + 158, 16, INK, 2);
    disc(tx + 9, y + 158, 9, [240, 120, 110]);
    for (let i = 0; i < 4; i++) hline(tx - 6, y + 58 + i * 26, 6, INK);
    // Cracked earth along the bottom.
    const by = y + h - 12;
    line(x + 14, by, x + 60, by - 8, BROWN);
    line(x + 60, by - 8, x + 96, by + 2, BROWN);
    line(x + 96, by + 2, x + 140, by - 10, BROWN);
    line(x + 140, by - 10, x + 186, by, BROWN);
    line(x + 186, by, x + 232, by - 6, BROWN);
    line(x + 232, by - 6, x + 268, by + 2, BROWN);
    drawTextCentered(x + w / 2, y + h - 48, 'NO DEAL', 2, RED);
  } else if (kind === 'flats') {
    // Apartment block, cracked, smoke rising, a drone overhead.
    const bx = x + 30;
    const by = y + 42;
    rect(bx, by, 58, 62, [216, 205, 180]);
    frame(bx, by, 58, 62, INK, 2);
    line(bx + 8, by + 62, bx + 20, by + 44, INK);
    line(bx + 20, by + 44, bx + 30, by + 56, INK);
    line(bx + 30, by + 56, bx + 44, by + 38, INK);
    for (const wy of [52, 70, 88]) {
      for (const wx of [38, 56, 74]) {
        rect(x + wx, y + wy, 8, 8, BLUE);
      }
    }
    smoke(x + 34, y + 26, GREY);
    line(x + 52, y + 18, x + 60, y + 12, INK);
    line(x + 68, y + 18, x + 60, y + 12, INK);
    disc(x + 60, y + 12, 3, INK);
    disc(x + 46, y + 18, 2, INK);
    disc(x + 74, y + 18, 2, INK);
  } else if (kind === 'derrick') {
    // Oil derrick and flame over an industrial site.
    const bx = x + 34;
    const by = y + 34;
    line(bx, y + 104, bx + 22, by, INK);
    line(bx + 44, y + 104, bx + 22, by, INK);
    line(bx + 6, y + 88, bx + 38, y + 88, INK);
    line(bx + 11, y + 70, bx + 33, y + 70, INK);
    line(bx + 16, y + 52, bx + 28, y + 52, INK);
    flames(bx + 12, by - 2, 1);
    rect(x + 78, y + 78, 30, 26, [216, 205, 180]);
    frame(x + 78, y + 78, 30, 26, INK, 2);
    rect(x + 84, y + 62, 5, 16, INK);
    smoke(x + 80, y + 52, GREY);
  } else if (kind === 'factory') {
    // Sawtooth factory roof, flames and smoke.
    const bx = x + 18;
    const by = y + 52;
    line(bx, by + 16, bx + 26, by - 12, INK);
    line(bx + 26, by - 12, bx + 26, by + 16, INK);
    line(bx + 26, by + 16, bx + 52, by - 12, INK);
    line(bx + 52, by - 12, bx + 52, by + 16, INK);
    line(bx + 52, by + 16, bx + 78, by - 12, INK);
    line(bx + 78, by - 12, bx + 78, by + 16, INK);
    rect(bx, by + 16, 78, 36, [216, 205, 180]);
    frame(bx, by + 16, 78, 36, INK, 2);
    rect(bx + 8, by + 26, 12, 12, BLUE);
    rect(bx + 32, by + 26, 12, 12, BLUE);
    rect(bx + 56, by + 26, 12, 12, BLUE);
    flames(bx + 6, by - 10, 1);
    smoke(x + 66, y + 22, GREY);
  } else if (kind === 'cap') {
    // Graduation cap over an open book.
    const cx = x + w / 2;
    fillTriangle(cx - 42, y + 34, cx, y + 16, cx + 42, y + 34, INK);
    fillTriangle(cx - 42, y + 34, cx, y + 52, cx + 42, y + 34, [70, 66, 58]);
    rect(cx - 16, y + 52, 32, 12, INK);
    line(cx + 42, y + 34, cx + 42, y + 58, GOLD);
    disc(cx + 42, y + 61, 4, GOLD);
    line(cx - 34, y + 84, cx, y + 74, INK);
    line(cx, y + 74, cx + 34, y + 84, INK);
    line(cx - 34, y + 84, cx - 34, y + 96, INK);
    line(cx + 34, y + 84, cx + 34, y + 96, INK);
    line(cx - 34, y + 96, cx, y + 86, INK);
    line(cx, y + 86, cx + 34, y + 96, INK);
    vline(cx, y + 74, 14, INK);
  } else if (kind === 'shield') {
    // Shield and magnifier over a server stack.
    const cx = x + 42;
    const cy = y + 58;
    line(cx - 26, cy - 26, cx + 26, cy - 26, INK);
    line(cx - 26, cy - 26, cx - 26, cy + 6, INK);
    line(cx + 26, cy - 26, cx + 26, cy + 6, INK);
    line(cx - 26, cy + 6, cx, cy + 28, INK);
    line(cx + 26, cy + 6, cx, cy + 28, INK);
    disc(cx, cy - 6, 8, RED);
    for (let i = 0; i < 3; i++) {
      const ry = y + 22 + i * 24;
      rect(x + 74, ry, 34, 16, [216, 205, 180]);
      frame(x + 74, ry, 34, 16, INK, 2);
      disc(x + 80, ry + 8, 2, RED);
      hline(x + 86, ry + 8, 14, INK);
    }
    ring(cx + 22, cy + 22, 16, INK, 3);
    line(cx + 34, cy + 34, cx + 46, cy + 46, INK);
    line(cx + 38, cy + 38, cx + 50, cy + 50, INK);
  }
}

// ---- page layout: one newspaper front page, 1024 x 1024 ----
const M = 30; // side margin
const CW = W - 2 * M; // 964 content width

function drawMasthead(): void {
  rect(M, 24, CW, 4, INK);
  drawTextCentered(W / 2, 38, 'THE WORLD IN ONE DAY', 6, INK);
  hline(M, 92, CW, INK);
  drawText(M, 102, 'ONE DAY — ONE PAGE', 1, GREY);
  drawTextCentered(W / 2, 102, 'SUNDAY, 22 NOVEMBER 2026', 2, INK);
  const right = 'SUNDAY EDITION';
  drawText(W - M - textWidth(right, 1), 102, right, 1, GREY);
  hline(M, 124, CW, INK);
  hline(M, 128, CW, INK);
}

function drawLead(): void {
  const y = 142;
  drawText(M, y, LEAD.kicker, 2, RED);
  for (let i = 0; i < LEAD.head.length; i++) {
    drawText(M, y + 26 + i * 36, LEAD.head[i], 4, INK);
  }
  drawPara(M, y + 108, LEAD.stand, 2, INK, 620, 18);
  // Pull quote from the closing session, as reported by CNN.
  hline(M, y + 196, 620, RED);
  drawPara(
    M,
    y + 206,
    '"We will not endorse a deal that does not even mention fossil fuels." — Darragh O\'Brien, Ireland\'s climate minister, speaking for the EU',
    2,
    INK,
    620,
    18,
  );
  drawIcon('globe', 700, y, 294, 250);
}

function drawCell2(s: Story, cx: number, cy: number): void {
  drawText(cx, cy, s.kicker, 2, RED);
  for (let i = 0; i < s.head.length; i++) {
    drawText(cx, cy + 24 + i * 26, s.head[i], 3, INK);
  }
  drawIcon(s.icon, cx, cy + 84, 120, 120);
  drawPara(cx + 136, cy + 86, s.stand, 2, INK, 334, 18);
}

function drawCell3(s: Story, cx: number, cy: number): void {
  drawText(cx, cy, s.kicker, 2, RED);
  for (let i = 0; i < s.head.length; i++) {
    drawText(cx, cy + 22 + i * 18, s.head[i], 2, INK);
  }
  drawIcon(s.icon, cx + 94, cy + 66, 120, 120);
  drawPara(cx, cy + 194, s.stand, 2, INK, 308, 18);
}

function drawPage(): void {
  fillCanvas(PAPER);
  drawMasthead();
  drawLead();
  // Rule under the lead story.
  hline(M, 408, CW, INK);
  // Row of two stories.
  drawCell2(GRID[0], M, 424);
  drawCell2(GRID[1], 554, 424);
  vline(527, 424, 248, GREY);
  // Rule between the rows.
  hline(M, 686, CW, INK);
  // Row of three stories.
  const cw3 = 308;
  const gap3 = 20;
  drawCell3(GRID[2], M, 702);
  drawCell3(GRID[3], M + cw3 + gap3, 702);
  drawCell3(GRID[4], M + 2 * (cw3 + gap3), 702);
  vline(M + cw3 + 10, 702, 290, GREY);
  vline(M + 2 * cw3 + gap3 + 10, 702, 290, GREY);
  // Footer: sources.
  hline(M, 1000, CW, INK);
  drawTextCentered(
    W / 2,
    1008,
    'Sources: CNN · AP · Reuters · AFP · The Times · The Wall Street Journal — 22 November 2026. Illustrations drawn in code.',
    1,
    GREY,
  );
}

// ---- PNG encoder: 8-bit RGB, filter 0, zlib level 9 (fully deterministic) ----

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- main ----
drawPage();
const png = encodePNG();
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png);
