package com.educontrolpro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";
    private static final String PREFS_NAME = "CapacitorStorage";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        
        String action = intent.getAction();
        Log.d(TAG, "📱 Broadcast recibido: " + action);
        
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            
            Log.d(TAG, "🚀 Dispositivo iniciado. Iniciando servicios de protección en segundo plano...");
            
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean isAdminActivated = prefs.getBoolean("admin_activated", false);
            String deviceId = prefs.getString("deviceId", null);
            
            Log.d(TAG, "Admin activado: " + isAdminActivated + ", Device ID: " + deviceId);
            
            // Solo iniciar servicios si el dispositivo está vinculado
            if (deviceId != null && !deviceId.isEmpty() && !deviceId.equals("student_unknown")) {
                // Pequeño retraso para asegurar que el sistema esté listo
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                    iniciarServicioMonitoreo(context);
                }, 3000);
                Log.d(TAG, "✅ Servicios de protección iniciados en segundo plano");
                
                // Notificar al panel web que el dispositivo ha reiniciado
                notificarReinicioPanel(context, deviceId);
            } else {
                Log.d(TAG, "Dispositivo no vinculado, servicio no iniciado automáticamente");
            }
        } else if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            Log.d(TAG, "🔄 App actualizada/instalada");
            
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String deviceId = prefs.getString("deviceId", null);
            
            if (deviceId != null && !deviceId.isEmpty() && !deviceId.equals("student_unknown")) {
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                    iniciarServicioMonitoreo(context);
                }, 2000);
                Log.d(TAG, "Servicio reiniciado después de actualización");
            }
        }
    }
    
    private void iniciarServicioMonitoreo(Context context) {
        try {
            Intent serviceIntent = new Intent(context, MonitorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
                Log.d(TAG, "✅ Foreground service iniciado (Android O+)");
            } else {
                context.startService(serviceIntent);
                Log.d(TAG, "✅ Service iniciado");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error iniciando MonitorService: " + e.getMessage());
        }
    }
    
    private void notificarReinicioPanel(Context context, String deviceId) {
        if (deviceId == null || deviceId.isEmpty() || deviceId.equals("student_unknown")) {
            Log.w(TAG, "Device ID no disponible para notificar reinicio");
            return;
        }
        
        try {
            com.google.firebase.database.DatabaseReference rtdb = 
                com.google.firebase.database.FirebaseDatabase.getInstance().getReference();
            
            java.util.HashMap<String, Object> data = new java.util.HashMap<>();
            data.put("ultimo_reinicio", System.currentTimeMillis());
            data.put("online", true);
            data.put("estado_boot", "dispositivo_iniciado");
            data.put("fecha_reinicio", new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new java.util.Date()));
            
            rtdb.child("status_dispositivos").child(deviceId).updateChildren(data)
                .addOnSuccessListener(aVoid -> Log.d(TAG, "✅ Reinicio notificado al panel web"))
                .addOnFailureListener(e -> Log.e(TAG, "❌ Error notificando reinicio: " + e.getMessage()));
                
            java.util.HashMap<String, Object> evento = new java.util.HashMap<>();
            evento.put("tipo", "BOOT_COMPLETED");
            evento.put("timestamp", System.currentTimeMillis());
            evento.put("deviceId", deviceId);
            evento.put("mensaje", "Dispositivo reiniciado correctamente");
            
            rtdb.child("eventos_sistema").child(deviceId).push().setValue(evento);
            
        } catch (Exception e) {
            Log.e(TAG, "Error notificando reinicio: " + e.getMessage());
        }
    }
}