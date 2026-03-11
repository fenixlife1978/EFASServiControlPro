package com.educontrolpro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.VpnService;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_DEVICE_ID = "deviceId";

    @Override
    public void onReceive(Context context, Intent intent) {

        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) ||
                "android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {

            SharedPreferences prefs = context.getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE);
            String deviceId = prefs.getString(KEY_DEVICE_ID, null);

            if (deviceId != null) {
                Log.d("EDU_Boot", "Dispositivo vinculado, iniciando servicios...");

                // 1. Iniciar MonitorService (Accesibilidad)
                Intent serviceIntent = new Intent(context, MonitorService.class);
                try {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent);
                    } else {
                        context.startService(serviceIntent);
                    }
                    Log.d("EDU_Boot", "MonitorService iniciado correctamente");
                } catch (Exception e) {
                    Log.e("EDU_Boot", "Error al iniciar MonitorService: " + e.getMessage());
                }

                // 2. Iniciar EduVpnService SOLO si ya tiene permiso
                if (VpnService.prepare(context) == null) {
                    Intent vpnIntent = new Intent(context, EduVpnService.class);
                    vpnIntent.setAction(EduVpnService.ACTION_START_VPN);

                    try {
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                            context.startForegroundService(vpnIntent);
                        } else {
                            context.startService(vpnIntent);
                        }
                        Log.d("EDU_Boot", "EduVpnService iniciado correctamente");
                    } catch (Exception e) {
                        Log.e("EDU_Boot", "Error al iniciar EduVpnService: " + e.getMessage());
                    }
                } else {
                    Log.w("EDU_Boot", "VPN no iniciada: falta permiso del usuario");
                }

            } else {
                Log.d("EDU_Boot", "Dispositivo no vinculado, no se inician servicios");
            }
        }
    }
}
