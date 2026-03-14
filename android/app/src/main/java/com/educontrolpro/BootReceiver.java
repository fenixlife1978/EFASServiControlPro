package com.educontrolpro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver
 {
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
                
                // 1. Iniciar MonitorService (el servicio correcto)
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
                // 2. Opcional: abrir la app (comentado para no interrumpir al usuario)
                // Intent launchIntent = new Intent(context, MainActivity.class);
                // launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                // context.startActivity(launchIntent);
            } else {
                Log.d("EDU_Boot", "Dispositivo no vinculado, no se inicia servicio");
            }
        }
    }
}
