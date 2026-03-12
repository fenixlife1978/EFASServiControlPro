package com.educontrolpro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d(TAG, "Arranque completado, iniciando servicios...");

            // Iniciar MonitorService (accesibilidad)
            Intent monitorIntent = new Intent(context, MonitorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(monitorIntent);
            } else {
                context.startService(monitorIntent);
            }

            // Iniciar VPN Service
            Intent vpnIntent = new Intent(context, ParentalControlVpnService.class);
            vpnIntent.setAction(ParentalControlVpnService.ACTION_START_VPN);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(vpnIntent);
            } else {
                context.startService(vpnIntent);
            }
        }
    }
}
