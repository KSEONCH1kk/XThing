import Foundation
import NetworkExtension

/**
 * Packet Tunnel Provider — extension target.
 *
 * Этот файл в плагине лежит как ШАБЛОН. Чтобы он реально заработал, его
 * нужно положить в ОТДЕЛЬНЫЙ Xcode target типа "Network Extension → Packet
 * Tunnel Provider", внутри основного приложения (рядом с App.app).
 * См. ios-setup.md для пошаговой инструкции.
 *
 * Что делает:
 *   1. Получает providerConfiguration от host-app (proto/address/port/payload).
 *   2. Стартует встроенное ядро (xray или hysteria) через xcframework, оно
 *      слушает SOCKS5 на 127.0.0.1:10808.
 *   3. Открывает packetFlow и направляет TUN ↔ SOCKS5 через встроенный
 *      hev-socks5-tunnel (xcframework).
 *
 * Места, где ИНТЕГРИРУЮТСЯ нативные ядра, помечены TODO. Их .xcframework
 * собирается отдельно (gomobile bind для xray/hysteria, ndk-аналог для hev).
 */
class PacketTunnelProvider: NEPacketTunnelProvider {

    private var coreRunning = false
    private var tunRunning = false

    override func startTunnel(options: [String: NSObject]?,
                              completionHandler: @escaping (Error?) -> Void) {
        guard
            let proto = protocolConfiguration as? NETunnelProviderProtocol,
            let cfg = proto.providerConfiguration,
            let kind = cfg["protocol"] as? String,
            let address = cfg["address"] as? String,
            let port = cfg["port"] as? Int,
            let payload = cfg["payload"] as? String
        else {
            completionHandler(NSError(
                domain: "XThingVPN", code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Bad providerConfiguration"]))
            return
        }

        // Сетевые настройки TUN-интерфейса.
        let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: address)
        let ipv4 = NEIPv4Settings(addresses: ["10.0.0.2"], subnetMasks: ["255.255.255.0"])
        ipv4.includedRoutes = [NEIPv4Route.default()]
        ipv4.excludedRoutes = [
            NEIPv4Route(destinationAddress: "10.0.0.0", subnetMask: "255.0.0.0"),
            NEIPv4Route(destinationAddress: "172.16.0.0", subnetMask: "255.240.0.0"),
            NEIPv4Route(destinationAddress: "192.168.0.0", subnetMask: "255.255.0.0"),
        ]
        settings.ipv4Settings = ipv4

        let dns = NEDNSSettings(servers: ["1.1.1.1", "8.8.8.8"])
        dns.matchDomains = [""]
        settings.dnsSettings = dns
        settings.mtu = 1500

        setTunnelNetworkSettings(settings) { [weak self] err in
            guard let self = self else { return }
            if let err = err {
                completionHandler(err); return
            }
            do {
                try self.startCore(kind: kind, address: address, port: port, payload: payload)
                try self.startTun2Socks()
                completionHandler(nil)
            } catch {
                completionHandler(error)
            }
        }
    }

    override func stopTunnel(with reason: NEProviderStopReason,
                             completionHandler: @escaping () -> Void) {
        stopTun2Socks()
        stopCore()
        completionHandler()
    }

    // MARK: - integration points (TODO: подключить xcframework'и)

    private func startCore(kind: String, address: String, port: Int, payload: String) throws {
        // TODO: интегрировать xray-core (для vless) / hysteria (для hysteria2)
        // как .xcframework. На iOS оба собираются gomobile bind'ом из их Go-исходников.
        //
        // VLESS:    Libv2ray.startLoop(buildXrayConfig(...), 0)
        // Hysteria: hyClient.start(buildHysteriaConfig(...))
        //
        // Конфиги — те же, что в Android/ConfigBuilders.java и electron/vpn/xray.ts.
        // Стало быть, удобно вынести build*Config в Swift и переиспользовать.
        coreRunning = true
    }

    private func stopCore() {
        guard coreRunning else { return }
        // TODO: Libv2ray.stopLoop() / hyClient.stop()
        coreRunning = false
    }

    private func startTun2Socks() throws {
        // TODO: hev-socks5-tunnel как .xcframework. На iOS он принимает packetFlow
        // не через fd, а через NEPacketTunnelFlow API. Альтернатива — собрать
        // tun2socks-ios (есть форки), либо leaf-tun.
        //
        // Сейчас просто крутим pump между packetFlow и SOCKS5 на 127.0.0.1:10808.
        tunRunning = true
        readPackets()
    }

    private func stopTun2Socks() {
        tunRunning = false
    }

    private func readPackets() {
        packetFlow.readPackets { [weak self] packets, _ in
            guard let self = self, self.tunRunning else { return }
            // TODO: отправлять packets через SOCKS5/UDP-over-TCP к ядру.
            // Без интеграции hev — packets просто дропаются.
            self.readPackets()
        }
    }
}
