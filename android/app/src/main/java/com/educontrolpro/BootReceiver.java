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
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) || 
            "android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            
            SharedPreferences prefs = context.getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE);
            String deviceId = prefs.getString(KEY_DEVICE_ID, null);
            
            if (deviceId != null) {
                Log.d(TAG, "Dispositivo vinculado (" + deviceId + "), iniciando servicios...");
                
                // 1. Iniciar MonitorService
                Intent serviceIntent = new Intent(context, MonitorService.class);
                try {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent);
                    } else {
                        context.startService(serviceIntent);
                    }
                    Log.d(TAG, "✓ MonitorService iniciado");
                } catch (Exception e) {
                    Log.e(TAG, "✗ Error al iniciar MonitorService: " + e.getMessage());
                }
                
                // 2. Pequeña pausa para no saturar el arranque
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    // Ignorar
                }
                
                // 3. Iniciar VPN si estaba activa (opcional - requeriría guardar estado)
                // Intent vpnIntent = new Intent(context, ParentalControlVpnService.class);
                // vpnIntent.setAction(ParentalControlVpnService.ACTION_START_VPN);
                // context.startService(vpnIntent);
                
            } else {
                Log.d(TAG, "Dispositivo no vinculado, servicios no iniciados");
            }
        }
    }
}
