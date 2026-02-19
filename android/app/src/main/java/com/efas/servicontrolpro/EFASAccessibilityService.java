package com.efas.servicontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.content.Intent;
import android.provider.Settings;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;
import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public class EFASAccessibilityService extends AccessibilityService {
    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private String deviceId;
    private List<String> blacklistedApps = new ArrayList<>();
    private String lastCapturedUrl = "";

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        deviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        setupRealtimeListener();
    }

    private void setupRealtimeListener() {
        if (deviceId == null) return;
        db.collection("dispositivos").document(deviceId)
            .addSnapshotListener((snapshot, e) -> {
                if (e != null || snapshot == null || !snapshot.exists()) return;
                List<String> apps = (List<String>) snapshot.get("blacklistedApps");
                if (apps != null) blacklistedApps = apps;
            });
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        String packageName = event.getPackageName() != null ? event.getPackageName().toString() : "";
        
        // 1. Bloqueo de Apps
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (blacklistedApps.contains(packageName)) {
                redirectToBlockPage();
                return;
            }
        }

        // 2. Captura de URLs (Chrome, Edge, Samsung Browser)
        if (packageName.contains("chrome") || packageName.contains("browser")) {
            captureUrl(getRootInActiveWindow());
        }
    }

    private void captureUrl(AccessibilityNodeInfo nodeInfo) {
        if (nodeInfo == null) return;
        
        // Buscamos nodos que parezcan barras de direcciones
        if ("android.widget.EditText".equals(nodeInfo.getClassName()) || "android.widget.TextView".equals(nodeInfo.getClassName())) {
            String text = nodeInfo.getText() != null ? nodeInfo.getText().toString() : "";
            if (text.contains(".") && (text.startsWith("http") || text.length() > 5) && !text.equals(lastCapturedUrl)) {
                lastCapturedUrl = text;
                saveUrlToFirestore(text);
            }
        }
        for (int i = 0; i < nodeInfo.getChildCount(); i++) {
            captureUrl(nodeInfo.getChild(i));
        }
    }

    private void saveUrlToFirestore(String url) {
        if (deviceId == null) return;
        Map<String, Object> log = new HashMap<>();
        log.put("url", url);
        log.put("timestamp", FieldValue.serverTimestamp());

        // Guardamos en un array de los últimos 20 para eficiencia
        db.collection("dispositivos").document(deviceId)
            .update("historialWeb", FieldValue.arrayUnion(log));
            
        // (Nota: La lógica para truncar a 20 se maneja mejor en el panel o con una Cloud Function)
    }

    private void redirectToBlockPage() {
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.setClassName("com.efas.servicontrolpro", "com.efas.servicontrolpro.MainActivity");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
    }

    @Override
    public void onInterrupt() {}
}
