package com.educontrolpro;

import android.content.Intent;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;

public class ParentalControlVpnService extends VpnService {
    private static final String TAG = "VPN-Minimal";

    // Constantes necesarias para VpnController
    public static final String ACTION_START_VPN = "START_VPN";
    public static final String ACTION_STOP_VPN = "STOP_VPN";

    private ParcelFileDescriptor vpnInterface;
    private Thread vpnThread;
    private volatile boolean isRunning = false;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Si es una orden de detención, paramos el servicio
        if (intent != null && ACTION_STOP_VPN.equals(intent.getAction())) {
            stopVpn();
            return START_NOT_STICKY;
        }

        if (vpnThread != null) return START_STICKY;
        isRunning = true;
        vpnThread = new Thread(this::runVpn, "VpnMinimalThread");
        vpnThread.start();
        return START_STICKY;
    }

    private void runVpn() {
        Log.i(TAG, "Hilo VPN iniciado");
        try {
            Builder builder = new Builder();
            builder.setSession("VPN Diagnóstico");
            builder.setMtu(1280);
            builder.addAddress("10.0.0.2", 32);
            builder.addRoute("0.0.0.0", 0);
            builder.addDnsServer("8.8.8.8");

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                Log.e(TAG, "Error: No se pudo establecer la interfaz");
                return;
            }

            FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
            FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());

            byte[] packet = new byte[32767];
            int packetCount = 0;

            while (isRunning && !Thread.interrupted()) {
                int length = in.read(packet);
                if (length > 0) {
                    packetCount++;
                    if (packetCount % 100 == 0) {
                        Log.d(TAG, "Paquetes reenviados: " + packetCount);
                    }
                    out.write(packet, 0, length);
                    out.flush();
                }
            }
        } catch (IOException e) {
            Log.e(TAG, "Error en el túnel: " + e.getMessage());
        } finally {
            stopVpn();
        }
    }

    private void stopVpn() {
        isRunning = false;
        if (vpnThread != null) {
            vpnThread.interrupt();
            try { vpnThread.join(1000); } catch (InterruptedException ignored) {}
            vpnThread = null;
        }
        if (vpnInterface != null) {
            try { vpnInterface.close(); } catch (IOException ignored) {}
            vpnInterface = null;
        }
        stopSelf();
    }

    @Override
    public void onDestroy() {
        stopVpn();
        super.onDestroy();
    }
}