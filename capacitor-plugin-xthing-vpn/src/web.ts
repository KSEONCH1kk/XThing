import { WebPlugin } from "@capacitor/core";
import type { XThingVpnPlugin, ConnectOptions } from "./definitions";

export class XThingVpnWeb extends WebPlugin implements XThingVpnPlugin {
  async connect(_options: ConnectOptions): Promise<void> {
    throw this.unimplemented("VPN недоступен в web — только Android.");
  }
  async disconnect(): Promise<void> {
    throw this.unimplemented("VPN недоступен в web — только Android.");
  }
  async prepare(): Promise<{ granted: boolean }> {
    return { granted: false };
  }
}
