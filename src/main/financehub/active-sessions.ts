/**
 * Shared active automator sessions registry.
 *
 * Both the FinanceHub UI (main.ts) and FinanceHubScheduler import this Map so
 * the scheduler can reuse an already-logged-in browser session rather than
 * creating a fresh one (which fails for banks like IBK/Hana/Woori that require
 * manual / corporate-certificate login).
 *
 * Keys:
 *  - Banks: bankId          (e.g. "ibk", "hana", "shinhan")
 *  - Cards: cardCompanyId   (e.g. "bc-card", "nh-card")
 */
export const activeAutomators = new Map<string, any>();
