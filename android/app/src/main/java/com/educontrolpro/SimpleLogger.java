package com.educontrolpro;

import android.util.Log;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;
import java.util.HashMap;
import java.util.Map;

public class SimpleLogger {
    private static final String TAG = "SimpleLogger";
    private static FirebaseFirestore db = FirebaseFirestore.getInstance();
    private static String deviceId = "unknown";
    private static boolean isInitialized = false;

    public static void init(String id) {
        deviceId = id != null ? id : "unknown";
        isInitialized = true;
        // Log de prueba al iniciar
        i("SimpleLogger inicializado para dispositivo: " + deviceId);
    }

    public static void d(String message) {
        log("DEBUG", message);
    }

    public static void i(String message) {
        log("INFO", message);
    }

    public static void e(String message) {
        log("ERROR", message);
    }

    public static void w(String message) {
        log("WARN", message);
    }

    private static void log(String level, String message) {
        // Siempre imprimir en logcat para depuración local
        if (level.equals("ERROR")) {
            Log.e(TAG, message);
        } else if (level.equals("WARN")) {
            Log.w(TAG, message);
        } else {
            Log.d(TAG, "[" + level + "] " + message);
        }

        // Solo intentar guardar en Firestore si está inicializado
        if (!isInitialized) {
            Log.d(TAG, "Logger no inicializado, mensaje no guardado: " + message);
            return;
        }

        try {
            Map<String, Object> logEntry = new HashMap<>();
            logEntry.put("deviceId", deviceId);
            logEntry.put("level", level);
            logEntry.put("message", message);
            logEntry.put("timestamp", System.currentTimeMillis());
            logEntry.put("app", "EDUControlPro");

            // Guardar en Firestore sin esperar respuesta (fire and forget)
            db.collection("app_logs")
                    .add(logEntry)
                    .addOnSuccessListener(documentReference -> {
                        Log.d(TAG, "Log guardado en Firestore: " + documentReference.getId());
                    })
                    .addOnFailureListener(e -> {
                        Log.e(TAG, "Error guardando log en Firestore: " + e.getMessage());
                    });
        } catch (Exception e) {
            Log.e(TAG, "Excepción al guardar log: " + e.getMessage());
        }
    }
}