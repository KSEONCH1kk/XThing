import Foundation
import Capacitor
import NetworkExtension

/**
 * iOS-сторона XThing VPN.
 *
 * Архитектура iOS отличается от Android:
 *   - Сам host-app не открывает TUN. Вместо этого он создаёт/обновляет
 *     `NETunnelProviderManager` (системный конфиг) и просит систему запустить
 *     отдельный target — Packet Tunnel Provider (PTP), который и открывает
 *     виртуальный сетевой интерфейс.
 *   - PTP — это *Network Extension*. Он живёт в отдельном бинаре, в собственной
 *     песочнице. Чтобы передавать ему конфиг/команды/получать статус,
 *     используется providerConfiguration (внутри NETunnelProviderProtocol).
 *
 * Этот класс — только thin proxy между JS и системным NEVPNManager.
 */
@objc(XThingVpnPlugin)
public class XThingVpnPlugin: CAPPlugin {
    static let providerBundleId = "com.xthing.vpn.ptp"  // совпадает с Bundle ID PTP-target

    private var statusObserver: NSObjectProtocol?

    public override func load() {
        // События NetworkExtension статуса -> наружу как "status".
        statusObserver = NotificationCenter.default.addObserver(
            forName: .NEVPNStatusDidChange,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let self = self,
                  let conn = note.object as? NEVPNConnection else { return }
            self.notifyListeners("status", data: ["state": Self.mapStatus(conn.status)])
        }
    }

    deinit {
        if let o = statusObserver { NotificationCenter.default.removeObserver(o) }
    }

    // MARK: - JS bridge

    @objc func prepare(_ call: CAPPluginCall) {
        // На iOS «разрешение» = пользователь подтверждает добавление VPN-конфига.
        // loadFromPreferences ничего не показывает; разрешение запросится при
        // saveToPreferences ниже. Здесь просто сообщаем, что мы готовы.
        call.resolve(["granted": true])
    }

    @objc func connect(_ call: CAPPluginCall) {
        guard
            let proto = call.getString("protocol"),
            let address = call.getString("address"),
            let port = call.getInt("port"),
            let payload = call.getString("payload")
        else {
            call.reject("Missing protocol/address/port/payload")
            return
        }

        NETunnelProviderManager.loadAllFromPreferences { managers, err in
            if let err = err {
                call.reject("loadFromPreferences: \(err.localizedDescription)")
                return
            }
            let mgr = managers?.first ?? NETunnelProviderManager()

            let proto = self.buildProtocolConfig(
                proto: proto, address: address, port: port, payload: payload)
            mgr.protocolConfiguration = proto
            mgr.localizedDescription = "XThing VPN"
            mgr.isEnabled = true

            // saveToPreferences. Если конфиг новый — система покажет диалог
            // «Разрешить XThing добавить VPN-конфигурацию?».
            mgr.saveToPreferences { saveErr in
                if let saveErr = saveErr {
                    call.reject("saveToPreferences: \(saveErr.localizedDescription)")
                    return
                }
                // После save нужно ещё раз loadFromPreferences, иначе session
                // может быть невалидной.
                mgr.loadFromPreferences { loadErr in
                    if let loadErr = loadErr {
                        call.reject("reload: \(loadErr.localizedDescription)")
                        return
                    }
                    do {
                        try mgr.connection.startVPNTunnel()
                        // Кэшируем последний конфиг в App Group, чтобы Shortcuts /
                        // расширения могли запустить VPN без UI.
                        Self.cacheLastConfig(
                            proto: call.getString("protocol") ?? "",
                            address: address, port: port, payload: payload)
                        call.resolve()
                    } catch {
                        call.reject("startVPNTunnel: \(error.localizedDescription)")
                    }
                }
            }
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        NETunnelProviderManager.loadAllFromPreferences { managers, _ in
            managers?.first?.connection.stopVPNTunnel()
            call.resolve()
        }
    }

    // MARK: - helpers

    private func buildProtocolConfig(proto: String, address: String, port: Int, payload: String) -> NETunnelProviderProtocol {
        let p = NETunnelProviderProtocol()
        p.providerBundleIdentifier = Self.providerBundleId
        p.serverAddress = address  // отображается в системных настройках

        // providerConfiguration — это Plist-словарь, который система передаст
        // в наш PTP. Все строки/числа — стандартные plist-типы.
        p.providerConfiguration = [
            "protocol": proto,
            "address": address,
            "port": port,
            "payload": payload,  // уже расшифрованный JSON-конфиг ядра (xray/hy2)
        ]
        // Иначе iOS на 14+ может выкинуть из памяти при засыпании.
        if #available(iOS 14.0, *) {
            p.includeAllNetworks = false      // можно поднять до true для kill-switch
            p.excludeLocalNetworks = true
        }
        return p
    }

    private static func mapStatus(_ s: NEVPNStatus) -> String {
        switch s {
        case .connected:     return "connected"
        case .connecting:    return "connecting"
        case .reasserting:   return "connecting"
        case .disconnecting: return "disconnecting"
        case .disconnected:  return "idle"
        case .invalid:       return "idle"
        @unknown default:    return "idle"
        }
    }

    // App Group кеш — для Shortcuts/Intents-расширений.
    static let appGroup = "group.com.xthing.vpn"
    private static func cacheLastConfig(proto: String, address: String, port: Int, payload: String) {
        guard let d = UserDefaults(suiteName: appGroup) else { return }
        d.set(proto, forKey: "last.proto")
        d.set(address, forKey: "last.address")
        d.set(port, forKey: "last.port")
        d.set(payload, forKey: "last.payload")
    }
}
