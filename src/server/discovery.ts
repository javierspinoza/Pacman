import os from "node:os";

export function getLanAddresses(): string[] {
  const out: string[] = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] ?? []) {
      if (info.family === "IPv4" && !info.internal) {
        out.push(info.address);
      }
    }
  }
  return out;
}

export interface DiscoveryHandle {
  stop: () => void;
  addresses: string[];
}

export async function startDiscovery(
  port: number,
  hostName: string
): Promise<DiscoveryHandle> {
  const addresses = getLanAddresses();
  try {
    const mod = await import("bonjour-service");
    const Bonjour = (mod as unknown as { Bonjour: new () => any }).Bonjour;
    const instance = new Bonjour();
    const service = instance.publish({
      name: `Pac-Man LAN (${hostName})`,
      type: "pacman",
      protocol: "tcp",
      port,
      txt: { version: "1", host: hostName },
    });
    return {
      stop: () => {
        try {
          service.stop?.();
          instance.destroy();
        } catch {
          /* ignore */
        }
      },
      addresses,
    };
  } catch (err) {
    console.warn("[discovery] mDNS not available:", (err as Error).message);
    return { stop: () => {}, addresses };
  }
}

export async function browseLan(timeoutMs = 2000): Promise<
  Array<{ name: string; host: string; port: number; addresses: string[] }>
> {
  try {
    const mod = await import("bonjour-service");
    const Bonjour = (mod as unknown as { Bonjour: new () => any }).Bonjour;
    const instance = new Bonjour();
    const found: Array<{
      name: string;
      host: string;
      port: number;
      addresses: string[];
    }> = [];
    const browser = instance.find({ type: "pacman", protocol: "tcp" }, (svc: any) => {
      found.push({
        name: svc.name,
        host: svc.host ?? "",
        port: svc.port,
        addresses: svc.addresses ?? [],
      });
    });
    await new Promise((r) => setTimeout(r, timeoutMs));
    browser.stop();
    instance.destroy();
    return found;
  } catch {
    return [];
  }
}
