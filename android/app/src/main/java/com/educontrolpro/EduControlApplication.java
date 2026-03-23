package com.educontrolpro;

import android.app.Application;
import android.util.Log;
import com.google.firebase.FirebaseApp;

public class EduControlApplication extends Application {
    private static final String TAG = "EduControlApp";

    @Override
    public void onCreate() {
        super.onCreate();
        
        // 1. Inicializar Firebase (usa google-services.json)
        try {
            FirebaseApp.initializeApp(this);
            Log.d(TAG, "✅ Firebase inicializado correctamente");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error inicializando Firebase", e);
        }
        
        // 2. Crear canales de notificación (Android 8+)
        // Asegúrate de que la clase NotificationUtils exista en tu proyecto
        try {
            NotificationUtils.createNotificationChannel(this);
            Log.d(TAG, "✅ Canales de notificación creados");
        } catch (Exception e) {
            Log.e(TAG, "⚠️ Error al crear canales de notificación: " + e.getMessage());
        }
    }
}