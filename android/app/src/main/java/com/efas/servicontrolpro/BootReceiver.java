package com.efas.servicontrolpro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_INSTITUTO_ID = "InstitutoId";

    @Override
    public void onReceive(Context context, Intent intent) {
        // Escuchamos el evento de arranque finalizado
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) || 
            "android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            
            Log.d("EFAS_Boot", "Tablet encendida. Verificando estado de protección...");

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String institutoId = prefs.getString(KEY_INSTITUTO_ID, null);

            // Si el dispositivo ya está vinculado, arrancamos el motor de bloqueo inmediatamente
            if (institutoId != null) {
                Log.d("EFAS_Boot", "Dispositivo vinculado. Reactivando AppBlockService.");
                
                Intent serviceIntent = new Intent(context, AppBlockService.class);
                // En versiones modernas de Android, esto asegura que el servicio inicie bien
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            }
        }
    }
}
