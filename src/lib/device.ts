/** A random id kept in this browser, used only to count a day's chat answers (so one device cannot use up the AI budget). Not an account, not tracking across sites. */
const KEY = "maithil-panji.device.v1";
export const DEVICE_RX = /^[a-z0-9]{12,24}$/;

export function deviceId(): string {
  try {
    let v = localStorage.getItem(KEY);
    if (!v || !DEVICE_RX.test(v)) {
      v = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join("") + Date.now().toString(36);
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch { return ""; }
}
