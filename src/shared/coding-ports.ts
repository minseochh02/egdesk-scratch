/**
 * Port conventions for EGDesk coding vs hosting.
 *
 * Already used internally (do NOT assign to user projects):
 *   8080 — EGDesk MCP / local API server
 *
 * Avoid locally (not Next-blocked, but OS/tool conflicts):
 *   5000 — macOS AirPlay Receiver
 *
 * See NEXTJS_RESERVED_PORTS for ports Next.js will refuse to bind.
 */

/** https://fetch.spec.whatwg.org/#port-blocking (via Next.js get-reserved-port.ts) */
export const NEXTJS_RESERVED_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79,
  87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137,
  139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540,
  548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049,
  3659, 4045, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080,
]);

/** Ports owned by EGDesk itself */
export const EGDESK_INTERNAL_PORTS = new Set([8080]);

/** Common local conflicts outside the WHATWG blocklist */
export const LOCAL_CONFLICT_PORTS = new Set([
  5000, // macOS AirPlay Receiver
]);

export const CODING_PORTS = {
  /** Production / hosting — matches Next.js `next start` default */
  production: {
    preferred: 3000,
    range: { start: 3000, end: 3099 },
  },
  /** Coding dev — 4000-series avoids 3000 prod, 5000 AirPlay, 6000 X11, and 8080 MCP */
  dev: {
    preferred: 4000,
    range: { start: 4000, end: 4099 },
  },
} as const;

export function getPreferredPort(mode: 'dev' | 'production'): number {
  return mode === 'dev' ? CODING_PORTS.dev.preferred : CODING_PORTS.production.preferred;
}

export function isPortAllowed(port: number): boolean {
  if (EGDESK_INTERNAL_PORTS.has(port)) return false;
  if (LOCAL_CONFLICT_PORTS.has(port)) return false;
  if (NEXTJS_RESERVED_PORTS.has(port)) return false;
  return port >= 1 && port <= 65535;
}

export function isDevPortAllowed(port: number): boolean {
  if (port < CODING_PORTS.dev.range.start || port > CODING_PORTS.dev.range.end) {
    return false;
  }
  return isPortAllowed(port);
}

export function isProductionPortAllowed(port: number): boolean {
  if (port < CODING_PORTS.production.range.start || port > CODING_PORTS.production.range.end) {
    return false;
  }
  return isPortAllowed(port);
}

export function getPortMode(port: number): 'dev' | 'production' | null {
  if (port >= CODING_PORTS.dev.range.start && port <= CODING_PORTS.dev.range.end) {
    return 'dev';
  }
  if (port >= CODING_PORTS.production.range.start && port <= CODING_PORTS.production.range.end) {
    return 'production';
  }
  return null;
}

export interface ActivePortInfo {
  port: number;
  mode: 'dev' | 'production';
  projectPath?: string;
  projectName?: string;
  processName?: string;
  pid?: number;
  status?: string;
}
