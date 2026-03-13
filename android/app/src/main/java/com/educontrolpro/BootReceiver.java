package com.educontrolpro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "EDU_Boot";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        
        // Cubrimos todos los flancos de encendido (Normal, QuickBoot y Reinicio por Software)
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {
            
            SimpleLogger.i("Boot: Sistema iniciado. Re-activando agentes invisibles...");

            // Usamos un pequeño delay de 1.5s para asegurar que el canal de notificaciones 
            // y los servicios de red del sistema estén listos para recibir los Foreground Services.
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                levantarEscudos(context);
            }, 1500);
        }
    }

    private void levantarEscudos(Context context) {
        try {
            // 1. Iniciar VPN Service (Filtro DNS)
            Intent vpnIntent = new Intent(context, ParentalControlVpnService.class);
            vpnIntent.setAction(ParentalControlVpnService.ACTION_START_VPN);
            
            // 2. Iniciar MonitorService (Accesibilidad y Bloqueo de Apps)
            Intent monitorIntent = new Intent(context, MonitorService.class);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(vpnIntent);
                context.startForegroundService(monitorIntent);
            } else {
                context.startService(vpnIntent);
                context.startService(monitorIntent);
            }
            
            SimpleLogger.i("Boot: Servicios re-activados exitosamente.");
            
        } catch (Exception e) {
            SimpleLogger.e("Boot: Error crítico al levantar escudos: " + e.getMessage());
        }
    }
}
