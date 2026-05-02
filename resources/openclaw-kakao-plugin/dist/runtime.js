let runtime = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let latestCfg = null;
export function setKakaoRuntime(r) {
    runtime = r;
}
export function getKakaoRuntime() {
    if (!runtime) {
        throw new Error("Kakao runtime not initialized - plugin not registered");
    }
    return runtime;
}
export function setKakaoCfg(cfg) {
    latestCfg = cfg;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getKakaoCfg() {
    return latestCfg;
}
//# sourceMappingURL=runtime.js.map