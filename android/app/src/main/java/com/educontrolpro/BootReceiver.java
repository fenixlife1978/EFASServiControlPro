package com.educontrolpro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import com.educontrolpro.services.LocalVpnService;
import com.educontrolpro.services.MonitorService;

public class BootReceiver extends BroadcastReceiver {
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String TAG = "EDU_Boot";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        // Capturar arranque completo y reinicio rápido (tablets chinas/Samsung)
        if (action.equals(Intent.ACTION_BOOT_COMPLETED) || 
            action.equals("android.intent.action.QUICKBOOT_POWERON") ||
            action.equals("com.htc.intent.action.QUICKBOOT_POWERON")) {
            
            SharedPreferences prefs = context.getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE);
            String deviceId = prefs.getString(KEY_DEVICE_ID, null);
            
            if (deviceId != null) {
                Log.d(TAG, "Dispositivo vinculado (" + deviceId + "). Iniciando servicios de protección...");
                
                // ============================================================
                // 1. INICIAR MonitorService (Accesibilidad)
                //    - Expulsión de apps prohibidas
                //    - Lectura de URLs
                // ============================================================
                Intent monitorIntent = new Intent(context, MonitorService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    try {
                        context.startForegroundService(monitorIntent);
                    } catch (Exception e) {
                        context.startService(monitorIntent);
                    }
                } else {
                    context.startService(monitorIntent);
                }
                Log.d(TAG, "MonitorService iniciado en arranque");
                
                // ============================================================
                // 2. INICIAR LocalVpnService (DNS Sinkhole)
                //    - Filtrado de tráfico por DNS
                //    - Bloqueo de dominios en lista negra
                // ============================================================
                Intent vpnIntent = new Intent(context, LocalVpnService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    try {
                        context.startForegroundService(vpnIntent);
                    } catch (Exception e) {
                        context.startService(vpnIntent);
                    }
                } else {
                    context.startService(vpnIntent);
                }
                Log.d(TAG, "LocalVpnService iniciado en arranque");
                
            } else {
                Log.d(TAG, "Dispositivo no vinculado, omitiendo arranque de servicios de protección.");
            }
        }
    }
}
