import { registerPlugin } from "@capacitor/core";
import type { XThingVpnPlugin } from "./definitions";

const XThingVpn = registerPlugin<XThingVpnPlugin>("XThingVpn", {
  web: () => import("./web").then((m) => new m.XThingVpnWeb()),
});

export * from "./definitions";
export { XThingVpn };
