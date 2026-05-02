#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Регистрация плагина и его методов для Capacitor JS-bridge'а.
// Имя "XThingVpn" должно совпадать с registerPlugin в client/src/lib/vpn-android.ts.
CAP_PLUGIN(XThingVpnPlugin, "XThingVpn",
    CAP_PLUGIN_METHOD(prepare,    CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(connect,    CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(disconnect, CAPPluginReturnPromise);
)
