package com.educontrolpro;

import android.util.Log;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.HashMap;
import java.util.Map;
import java.util.Date;

public class SimpleLogger {
    private static final String TAG = "EduControlPro";
    private static final String COLLECTION_LOGS = "device_logs";

    // Niveles de Log
    public static void i(String message) {
        log("INFO", message);
    }

    public static void e(String message) {
        log("ERROR", message);
    }

    public static void d(String message) {
        log("DEBUG", message);
    }

    public static void w(String message) {
        log("WARN", message);
    }

    private static void log(String level, String message) {
        // 1. Imprimir en consola local (Logcat)
        switch (level) {
            case "INFO": Log.i(TAG, message); break;
            case "ERROR": Log.e(TAG, message); break;
            case "DEBUG": Log.d(TAG, message); break;
            case "WARN": Log.w(TAG, message); break;
        }

        // 2. Enviar a Firestore (Solo errores e información crítica para no saturar)
        if (level.equals("ERROR") || level.equals("INFO")) {
            sendToFirestore(level, message);
        }
    }

    private static void sendToFirestore(String level, String message) {
        try {
            FirebaseFirestore db = FirebaseFirestore.getInstance();
            Map<String, Object> logEntry = new HashMap<>();
            logEntry.put("level", level);
            logEntry.put("message", message);
            logEntry.put("timestamp", new Date());
            logEntry.put("device_model", android.os.Build.MODEL);

            db.collection(COLLECTION_LOGS)
                .add(logEntry)
                .addOnFailureListener(e -> Log.e(TAG, "Fallo al subir log a Firestore: " + e.getMessage()));
        } catch (Exception e) {
            Log.e(TAG, "Error inicializando Firestore en Logger: " + e.getMessage());
        }
    }
}