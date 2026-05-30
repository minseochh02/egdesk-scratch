/**
 * Returns true when Antigravity is installed.
 * Otherwise opens the install page and returns false.
 */
export async function requireAntigravity(): Promise<boolean> {
  const electron = (window as any).electron;
  const check = await electron.ipcRenderer.invoke('coding:check-antigravity');
  if (check?.available) return true;
  await electron.ipcRenderer.invoke('coding:open-antigravity-install');
  return false;
}
