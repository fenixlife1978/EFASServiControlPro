package com.educontrolpro;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

public class NotificationUtils {

    public static final String CHANNEL_ID = "educontrol_guardian_channel";
    public static final String CHANNEL_NAME = "Protección EduControlPro";
    public static final String CHANNEL_DESC = "Mantiene activa la protección y el filtrado de contenidos en el dispositivo.";
    
    // Canal adicional para alertas de bloqueo
    public static final String ALERT_CHANNEL_ID = "educontrol_alert_channel";
    public static final String ALERT_CHANNEL_NAME = "Alertas EduControlPro";
    public static final String ALERT_CHANNEL_DESC = "Notificaciones de bloqueo y alertas de seguridad.";

    /**
     * Crea el canal de notificación principal requerido para Android 8.0+
     * Se recomienda llamar esto en el onCreate de la Application class o la MainActivity.
     */
    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            
            // Canal principal (IMPORTANCE_LOW - persistente sin sonido)
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription(CHANNEL_DESC);
            channel.setShowBadge(false);
            channel.enableLights(false);
            channel.enableVibration(false);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            // Canal de alertas (IMPORTANCE_HIGH - para bloqueos importantes)
            NotificationChannel alertChannel = new NotificationChannel(
                    ALERT_CHANNEL_ID,
                    ALERT_CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            alertChannel.setDescription(ALERT_CHANNEL_DESC);
            alertChannel.setShowBadge(true);
            alertChannel.enableLights(true);
            alertChannel.enableVibration(true);
            alertChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
                manager.createNotificationChannel(alertChannel);
            }
        }
    }
    
    /**
     * Verifica si los canales de notificación están creados
     */
    public static boolean areChannelsCreated(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                NotificationChannel channel = manager.getNotificationChannel(CHANNEL_ID);
                return channel != null;
            }
        }
        return true; // En versiones anteriores siempre están "creados"
    }
}