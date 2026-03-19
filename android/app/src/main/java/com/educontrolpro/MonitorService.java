package com.educontrolpro.services;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ServerValue;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MonitorService extends AccessibilityService {

    private static final String TAG = "EDU_Monitor";
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_DEVICE_ID = "deviceId";

    private DatabaseReference mDatabase;
    private String cachedDeviceId;

    // --- CONFIGURACIÓN DE BLOQUEO ---
    private final List<String> blacklistedWords = Arrays.asList(
        "porno", "juegos", "casino", "armas", "gore", "sexo", "xxx", "hentai", "dating", "apuestas"
    );
    
    private final List<String> browserPackages = Arrays.asList(
        "com.android.chrome", "org.mozilla.firefox", "com.opera.browser", 
        "com.microsoft.emmx", "com.sec.android.app.sbrowser"
    );

    private final List<String> searchActionIds = Arrays.asList(
        "com.android.chrome:id/url_bar",
        "com.android.chrome:id/line_1",
        "org.mozilla.firefox:id/mozac_browser_toolbar_url_view",
        "com.opera.browser:id/url_field"
    );

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        // Inicializar referencia a Firebase
        mDatabase = FirebaseDatabase.getInstance().getReference("system_analysis/blocked_attempts");
        
        // Cargar DeviceID desde las preferencias de Capacitor
        SharedPreferences prefs = getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE);
        cachedDeviceId = prefs.getString(KEY_DEVICE_ID, "unknown_device");

        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED | AccessibilityEvent.TYPE_VIEW_CLICKED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 50;
        info.flags = AccessibilityServiceInfo.DEFAULT | 
                     AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS |
                     AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
        setServiceInfo(info);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getPackageName() == null) return;
        String packageName = event.getPackageName().toString().toLowerCase();

        if (browserPackages.contains(packageName)) {
            int eventType = event.getEventType();
            if (eventType == AccessibilityEvent.TYPE_VIEW_CLICKED || 
                eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                validateAndCleanSearch(packageName);
            }
        }
    }

    private void validateAndCleanSearch(String currentPackage) {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;

        for (String viewId : searchActionIds) {
            List<AccessibilityNodeInfo> nodes = rootNode.findAccessibilityNodeInfosByViewId(viewId);
            if (nodes != null && !nodes.isEmpty()) {
                AccessibilityNodeInfo searchNode = nodes.get(0);
                CharSequence rawText = searchNode.getText();
                String searchText = (rawText != null) ? rawText.toString().toLowerCase().trim() : "";

                if (isForbiddenContent(searchText)) {
                    // 1. ENVIAR LOG A FIREBASE (Antes de limpiar y salir)
                    sendReportToFirebase(searchText);

                    // 2. LIMPIEZA Y BLOQUEO
                    Bundle arguments = new Bundle();
                    arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "");
                    searchNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
                    performGlobalAction(GLOBAL_ACTION_HOME);
                    break;
                }
            }
        }
    }

    private void sendReportToFirebase(String forbiddenUrl) {
        if (mDatabase == null) return;

        // Estructura que espera tu Dashboard en Next.js
        Map<String, Object> report = new HashMap<>();
        report.put("deviceId", cachedDeviceId);
        report.put("url", forbiddenUrl);
        report.put("timestamp", ServerValue.TIMESTAMP); // Timestamp del servidor para precisión
        report.put("status", "blocked");

        // Generar un ID único para el log y subirlo
        mDatabase.push().setValue(report)
            .addOnSuccessListener(aVoid -> Log.d(TAG, "Log enviado: " + forbiddenUrl))
            .addOnFailureListener(e -> Log.e(TAG, "Error al enviar log: " + e.getMessage()));
    }

    private boolean isForbiddenContent(String text) {
        if (text == null || text.isEmpty()) return false;
        for (String word : blacklistedWords) {
            if (text.contains(word)) return true;
        }
        return false;
    }

    @Override public void onInterrupt() {}
}