package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import com.google.firebase.firestore.FirebaseFirestore;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

public class MonitorService extends AccessibilityService {

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    
    // Variables de configuración dinámica
    private boolean enviarAFirebase = true;
    private boolean enviarAServidor = false;
    private String urlServidor = "";

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        Log.d("EDU_Monitor", "Servicio Conectado. Escuchando configuración...");
        
        // Listener en tiempo real para cambios en la configuración desde Firestore
        db.collection("config").document("app_settings")
            .addSnapshotListener((snapshot, e) -> {
                if (e != null) {
                    Log.e("EDU_Monitor", "Error al escuchar configuración", e);
                    return;
                }
                if (snapshot != null && snapshot.exists()) {
                    enviarAFirebase = snapshot.getBoolean("firebase_enabled") != null ? snapshot.getBoolean("firebase_enabled") : true;
                    enviarAServidor = snapshot.getBoolean("server_enabled") != null ? snapshot.getBoolean("server_enabled") : false;
                    urlServidor = snapshot.getString("server_url") != null ? snapshot.getString("server_url") : "";
                    Log.d("EDU_Monitor", "Configuración actualizada. Servidor: " + urlServidor);
                }
            });

        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS;
        setServiceInfo(info);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && event.getPackageName() != null) {
            String packageName = event.getPackageName().toString();
            
            enviarLog(packageName);

            if (packageName.contains("tiktok") || packageName.contains("instagram") || 
                packageName.contains("facebook") || packageName.contains("youtube")) {
                
                Intent lockIntent = new Intent(this, LockActivity.class);
                lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(lockIntent);
            }
        }
    }

    private void enviarLog(String packageName) {
        Map<String, Object> log = new HashMap<>();
        log.put("app", packageName);
        log.put("timestamp", System.currentTimeMillis());

        // 1. Envío a Firebase (si está activo)
        if (enviarAFirebase) {
            db.collection("activity_logs").add(log);
        }

        // 2. Envío a Servidor Propio (si está activo)
        if (enviarAServidor && !urlServidor.isEmpty()) {
            enviarAServidorPropio(packageName, urlServidor);
        }
    }

    private void enviarAServidorPropio(String packageName, String url) {
        new Thread(() -> {
            try {
                URL endpoint = new URL(url);
                HttpURLConnection conn = (HttpURLConnection) endpoint.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; utf-8");
                conn.setDoOutput(true);

                String jsonInputString = "{\"app\": \"" + packageName + "\", \"timestamp\": " + System.currentTimeMillis() + "}";
                
                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonInputString.getBytes("utf-8");
                    os.write(input, 0, input.length);
                }
                
                int code = conn.getResponseCode();
                Log.d("EDU_Monitor", "Respuesta del servidor: " + code);
            } catch (Exception e) {
                Log.e("EDU_Monitor", "Error al enviar al servidor: " + e.getMessage());
            }
        }).start();
    }

    @Override
    public void onInterrupt() {
        Log.e("EDU_Monitor", "Servicio interrumpido");
    }
}