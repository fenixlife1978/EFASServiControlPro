package com.educontrolpro;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

public class NotificationUtils {

    public static final String CHANNEL_ID = "educontrol_guardian_channel";
    public static final String CHANNEL_NAME = "Protección EduControlPro";
    public static final String CHANNEL_DESC = "Mantiene activa la protección y el filtrado de contenidos en el dispositivo.";

    /**
     * Crea el canal de notificación requerido para Android 8.0+
     * Se recomienda llamar esto en el onCreate de la Application class o la MainActivity.
     */
    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            
            // IMPORTANCE_LOW: Permite que sea persistente sin interrumpir con sonidos.
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
            );
            
            channel.setDescription(CHANNEL_DESC);
            channel.setShowBadge(false); // No mostrar punto de notificación en el icono
            channel.enableLights(false);
            channel.enableVibration(false);
            
            // Opcional: Impedir que el usuario vea contenido sensible en la pantalla de bloqueo
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}