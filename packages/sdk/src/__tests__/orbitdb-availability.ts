export function hasOrbitDbNativeSupport(): boolean {
  try {
    require("@ipshipyard/node-datachannel");
    return true;
  } catch {
    return false;
  }
}
