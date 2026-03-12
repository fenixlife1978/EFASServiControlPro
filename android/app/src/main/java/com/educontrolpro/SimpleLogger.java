package com.educontrolpro;

import android.util.Log;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.HashMap;
import java.util.Map;

public class SimpleLogger {
    private static final String TAG = "SimpleLogger";
    private static FirebaseFirestore db = FirebaseFirestore.getInstance();
    private static String deviceId = "unknown";

    public static void init(String id) {
        deviceId = id;
    }

    public static void log(String level, String message) {
        // También imprimimos en logcat por si acaso
        if (level.equals("ERROR")) {
            Log.e(TAG, message);
        } else {
            Log.d(TAG, message);
        }

        // Guardar en Firestore
        Map<String, Object> logEntry = new HashMap<>();
        logEntry.put("deviceId", deviceId);
        logEntry.put("level", level);
        logEntry.put("message", message);
        logEntry.put("timestamp", System.currentTimeMillis());

        db.collection("app_logs")
                .add(logEntry)
                .addOnFailureListener(e -> Log.e(TAG, "Error guardando log: " + e.getMessage()));
    }

    public static void d(String message) { log("DEBUG", message); }
    public static void e(String message) { log("ERROR", message); }
    public static void i(String message) { log("INFO", message); }
}