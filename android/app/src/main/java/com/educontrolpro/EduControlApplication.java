package com.educontrolpro;

import android.app.Application;
import android.content.SharedPreferences;
import android.util.Log;

import com.google.firebase.FirebaseApp;
import com.google.firebase.database.FirebaseDatabase;

public class EduControlApplication extends Application {
    private static final String TAG = "EduControlApp";
    private static final String PREFS_NAME = "CapacitorStorage";

    @Override
    public void onCreate() {
        super.onCreate();
        
        Log.d(TAG, "========================================");
        Log.d(TAG, "🚀 EduControlPro Application Iniciada");
        Log.d(TAG, "========================================");
        
        // 1. Inicializar Firebase de forma segura
        inicializarFirebase();
        
        // 2. Crear canales de notificación (Android 8+)
        try {
            NotificationUtils.createNotificationChannels(this);
            Log.d(TAG, "✅ Canales de notificación creados");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error en NotificationUtils: " + e.getMessage());
        }
        
        // 3. Verificar y crear device ID si no existe
        verificarDeviceId();
        
        // 4. Registrar inicio de aplicación en logs
        registrarInicioApp();
        
        Log.d(TAG, "✅ Aplicación inicializada correctamente");
    }
    
    private void inicializarFirebase() {
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp.initializeApp(this);
                Log.d(TAG, "🔥 Firebase inicializado por primera vez");
            } else {
                Log.d(TAG, "🔥 Firebase ya estaba inicializado");
            }

            FirebaseDatabase db = FirebaseDatabase.getInstance();
            if (db != null) {
                try {
                    db.setPersistenceEnabled(true);
                    Log.d(TAG, "💾 Persistencia de Firebase habilitada");
                } catch (Exception e) {
                    Log.w(TAG, "⚠️ La persistencia ya estaba activa: " + e.getMessage());
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error crítico en inicializarFirebase: " + e.getMessage());
        }
    }
    
    private void verificarDeviceId() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String deviceId = prefs.getString("deviceId", null);
            
            if (deviceId == null || deviceId.isEmpty() || deviceId.equals("student_unknown")) {
                Log.d(TAG, "⚠️ Device ID no existe o es inválido: " + deviceId);
                Log.d(TAG, "📱 Se generará en MainActivity al vincular");
            } else {
                Log.d(TAG, "📱 Device ID existente: " + deviceId);
                
                try {
                    com.google.firebase.database.DatabaseReference rtdb = 
                        com.google.firebase.database.FirebaseDatabase.getInstance().getReference();
                    java.util.HashMap<String, Object> update = new java.util.HashMap<>();
                    update.put("ultimo_acceso_app", System.currentTimeMillis());
                    update.put("online", true);
                    rtdb.child("status_dispositivos").child(deviceId).updateChildren(update);
                } catch (Exception e) {
                    Log.e(TAG, "Error actualizando último acceso: " + e.getMessage());
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error verificando deviceId: " + e.getMessage());
        }
    }
    
    private void registrarInicioApp() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String deviceId = prefs.getString("deviceId", null);
            
            if (deviceId != null && !deviceId.isEmpty() && !deviceId.equals("student_unknown")) {
                com.google.firebase.database.DatabaseReference rtdb = 
                    com.google.firebase.database.FirebaseDatabase.getInstance().getReference();
                
                java.util.HashMap<String, Object> evento = new java.util.HashMap<>();
                evento.put("tipo", "APP_STARTED");
                evento.put("timestamp", System.currentTimeMillis());
                evento.put("fecha", new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new java.util.Date()));
                
                // Manejo seguro de BuildConfig - evitar error si no existe
                try {
                    // Intentar obtener versión desde package manager si BuildConfig no está disponible
                    String versionName = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
                    int versionCode = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
                    evento.put("version", versionName);
                    evento.put("version_code", versionCode);
                } catch (Exception e) {
                    evento.put("version", "unknown");
                    evento.put("version_code", 0);
                    Log.w(TAG, "No se pudo obtener versión: " + e.getMessage());
                }
                
                rtdb.child("eventos_sistema").child(deviceId).push().setValue(evento)
                    .addOnFailureListener(e -> Log.e(TAG, "Error registrando inicio: " + e.getMessage()));
            }
        } catch (Exception e) {
            Log.e(TAG, "Error en registrarInicioApp: " + e.getMessage());
        }
    }
    
    /**
     * Método público para obtener el deviceId desde cualquier parte de la app
     */
    public static String getDeviceId(Application app) {
        SharedPreferences prefs = app.getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        return prefs.getString("deviceId", null);
    }
    
    /**
     * Método público para verificar si el admin está activado
     */
    public static boolean isAdminActivated(Application app) {
        SharedPreferences prefs = app.getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        return prefs.getBoolean("admin_activated", false);
    }
}