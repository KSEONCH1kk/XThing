package com.xthing.vpn;

/**
 * JNI-обёртка вокруг hev-socks5-tunnel (libhev-socks5-tunnel.so).
 *
 * Нативные методы привязаны к C-функциям через jni-шим (hev-jni-shim.c
 * в исходниках hev-socks5-tunnel/, собирается в ту же .so).
 *
 * nativeMain() БЛОКИРУЕТСЯ до nativeQuit() или ошибки — вызывать в
 * фоновом потоке.
 */
public final class HevSocks5Tunnel {
    static {
        System.loadLibrary("hev-socks5-tunnel");
    }

    /**
     * Запустить tun2socks. Блокирующий вызов.
     * @return 0 при штатном завершении (после quit), -1 при ошибке.
     */
    public static native int nativeMain(String configPath, int tunFd);

    /** Остановить (разблокирует поток с nativeMain). */
    public static native void nativeQuit();

    /**
     * Вернуть статистику адаптера: { tx_packets, tx_bytes, rx_packets, rx_bytes }.
     * tx — отправлено наружу, rx — получено с TUN-стороны.
     */
    public static native long[] nativeStats();

    private HevSocks5Tunnel() {}
}
