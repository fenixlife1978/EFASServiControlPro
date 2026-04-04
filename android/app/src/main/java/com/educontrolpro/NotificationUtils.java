package com.educontrolpro;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

public class NotificationUtils {

    public static final String CHANNEL_ID = "educontrol_guardian_channel";
    public static final String CHANNEL_NAME = "Protección EduControlPro";
    public static final String CHANNEL_DESC = "Mantiene activa la protección y el filtrado de contenidos en el dispositivo.";
    
    public static final String ALERT_CHANNEL_ID = "educontrol_alert_channel";
    public static final String ALERT_CHANNEL_NAME = "Alertas EduControlPro";
    public static final String ALERT_CHANNEL_DESC = "Notificaciones de bloqueo y alertas de seguridad.";
    
    public static final String MESSAGE_CHANNEL_ID = "educontrol_message_channel";
    public static final String MESSAGE_CHANNEL_NAME = "Mensajes Dirección";
    public static final String MESSAGE_CHANNEL_DESC = "Mensajes importantes de la dirección del centro educativo.";
    
    private static final String TAG = "NotificationUtils";

    /**
     * Crea los canales de notificación requeridos para Android 8.0+
     * Debe llamarse en el onCreate de la Application class
     */
    public static void createNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationManager manager = context.getSystemService(NotificationManager.class);
                if (manager == null) return;
                
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
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                manager.createNotificationChannel(channel);
                android.util.Log.d(TAG, "✅ Canal principal creado: " + CHANNEL_ID);
                
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
                alertChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                manager.createNotificationChannel(alertChannel);
                android.util.Log.d(TAG, "✅ Canal de alertas creado: " + ALERT_CHANNEL_ID);
                
                // Canal de mensajes (IMPORTANCE_HIGH - para mensajes del director)
                NotificationChannel messageChannel = new NotificationChannel(
                        MESSAGE_CHANNEL_ID,
                        MESSAGE_CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                );
                messageChannel.setDescription(MESSAGE_CHANNEL_DESC);
                messageChannel.setShowBadge(true);
                messageChannel.enableLights(true);
                messageChannel.enableVibration(true);
                messageChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                manager.createNotificationChannel(messageChannel);
                android.util.Log.d(TAG, "✅ Canal de mensajes creado: " + MESSAGE_CHANNEL_ID);
                
            } catch (Exception e) {
                android.util.Log.e(TAG, "❌ Error creando canales: " + e.getMessage());
            }
        }
    }
    
    /**
     * Obtiene una notificación para el servicio en primer plano
     */
    public static Notification getForegroundNotification(Context context) {
        String title = "🔒 EduControlPro Activo";
        String content = "Protección y filtrado de contenidos funcionando correctamente";
        
        Intent notificationIntent = new Intent(context, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(content)
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setColor(context.getResources().getColor(android.R.color.holo_blue_dark));
        
        return builder.build();
    }
    
    /**
     * Crea una notificación de alerta para bloqueos
     */
    public static void showBlockAlert(Context context, String title, String message) {
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;
            
            Intent intent = new Intent(context, BlockActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context, (int) System.currentTimeMillis(), intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, ALERT_CHANNEL_ID)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setSmallIcon(android.R.drawable.ic_dialog_alert)
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setVibrate(new long[]{0, 500, 250, 500})
                    .setColor(context.getResources().getColor(android.R.color.holo_red_dark));
            
            manager.notify((int) System.currentTimeMillis(), builder.build());
            android.util.Log.d(TAG, "🔔 Alerta mostrada: " + title);
            
        } catch (Exception e) {
            android.util.Log.e(TAG, "❌ Error mostrando alerta: " + e.getMessage());
        }
    }
    
    /**
     * Crea una notificación para mensajes del director
     */
    public static void showMessageNotification(Context context, String title, String message, String messageId) {
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;
            
            Intent intent = new Intent(context, MessageActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.putExtra("mensaje", message);
            intent.putExtra("remitente", title);
            intent.putExtra("messageId", messageId);
            
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context, (int) System.currentTimeMillis(), intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, MESSAGE_CHANNEL_ID)
                    .setContentTitle("📨 " + title)
                    .setContentText(message.length() > 80 ? message.substring(0, 80) + "..." : message)
                    .setSmallIcon(android.R.drawable.ic_dialog_email)
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setVibrate(new long[]{0, 300, 200, 300})
                    .setColor(context.getResources().getColor(android.R.color.holo_blue_dark));
            
            manager.notify((int) System.currentTimeMillis(), builder.build());
            android.util.Log.d(TAG, "📧 Notificación de mensaje mostrada");
            
        } catch (Exception e) {
            android.util.Log.e(TAG, "❌ Error mostrando notificación de mensaje: " + e.getMessage());
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
        return true;
    }
    
    /**
     * Cancela todas las notificaciones
     */
    public static void cancelAllNotifications(Context context) {
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.cancelAll();
                android.util.Log.d(TAG, "✅ Todas las notificaciones canceladas");
            }
        } catch (Exception e) {
            android.util.Log.e(TAG, "❌ Error cancelando notificaciones: " + e.getMessage());
        }
    }
}