import type { PluginRuntime } from "openclaw/plugin-sdk/channel-core";

let runtime: PluginRuntime | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let latestCfg: any = null;

export function setKakaoRuntime(r: PluginRuntime): void {
  runtime = r;
}

export function getKakaoRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Kakao runtime not initialized - plugin not registered");
  }
  return runtime;
}

export function setKakaoCfg(cfg: unknown): void {
  latestCfg = cfg;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getKakaoCfg(): any {
  return latestCfg;
}
