package com.educontrolpro;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

public class NotificationUtils {

    public static final String CHANNEL_ID = "educontrol_vpn_channel";
    public static final String CHANNEL_NAME = "Servicio de Control Parental";
    public static final String CHANNEL_DESC = "Notificación persistente para el filtrado de contenido";

    /**
     * Crea el canal de notificación requerido para Android 8.0+
     * Se debe llamar en el onCreate del Servicio o de la MainActivity.
     */
    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW // Low para que no haga ruidos molestos
            );
            channel.setDescription(CHANNEL_DESC);

            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}