package com.educontrolpro.services;

import android.content.Intent;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;
import android.util.Log;

public class LocalVpnService extends VpnService {
    private static final String TAG = "EDU_Vpn";
    private ParcelFileDescriptor vpnInterface;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP_VPN".equals(intent.getAction())) {
            stopVpn();
            stopSelf();
            return START_NOT_STICKY;
        }
        setupVpn();
        return START_STICKY;
    }

    private void setupVpn() {
        if (vpnInterface != null) {
            Log.d(TAG, "VPN ya está activa.");
            return;
        }

        try {
            Builder builder = new Builder();
            builder.setSession("EDUControlPro VPN Escudo")
                   .addAddress("10.0.0.2", 32); 
            // Configuramos una dummy interface VPN. 
            // Al NO añadir `.addRoute("0.0.0.0", 0)`, el tráfico regular 
            // sigue usando la conexión a Internet por defecto.
            // Esto actúa como un escudo protector (Android Status Bar Lock)
            // para evitar que los estudiantes instalen otra VPN.
            // El filtrado real de URLs (HTTPS) lo gestiona el MonitorService (Accessibility).
            
            vpnInterface = builder.establish();
            Log.d(TAG, "VPN Escudo Local iniciado exitosamente.");
        } catch (Exception e) {
            Log.e(TAG, "Error iniciando VPN", e);
            e.printStackTrace();
        }
    }

    private void stopVpn() {
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopVpn();
    }
}
