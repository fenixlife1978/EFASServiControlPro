package com.educontrolpro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String TAG = "EDU_Boot";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        // Capturamos el arranque completo y el reinicio rápido (común en tablets chinas/Samsung)
        if (action.equals(Intent.ACTION_BOOT_COMPLETED) || 
            action.equals("android.intent.action.QUICKBOOT_POWERON") ||
            action.equals("com.htc.intent.action.QUICKBOOT_POWERON")) {
            
            SharedPreferences prefs = context.getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE);
            String deviceId = prefs.getString(KEY_DEVICE_ID, null);
            
            if (deviceId != null) {
                Log.d(TAG, "Dispositivo vinculado (" + deviceId + "). Verificando persistencia...");
                
                // Si usas una VPN o un Servicio de Notificaciones persistente, 
                // aquí es donde debes lanzarlos.
                
                Intent vpnIntent = new Intent(context, com.educontrolpro.services.LocalVpnService.class);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    try {
                        context.startForegroundService(vpnIntent);
                    } catch (Exception e) {
                        context.startService(vpnIntent);
                    }
                } else {
                    context.startService(vpnIntent);
                }

            } else {
                Log.d(TAG, "Dispositivo no vinculado, omitiendo arranque de guardianes.");
            }
        }
    }
}
