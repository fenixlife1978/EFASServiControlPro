package com.educontrolpro.services;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import androidx.annotation.NonNull;

import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ServerValue;
import com.google.firebase.database.ValueEventListener;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MonitorService extends AccessibilityService {

    private static final String TAG = "EDU_Monitor";
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_DEVICE_ID = "deviceId";

    private DatabaseReference mDatabase;
    private DatabaseReference blacklistRef;
    private String cachedDeviceId;

    // --- LISTA NEGRA DINÁMICA (Sincronizada con Dashboard) ---
    private final List<String> dynamicBlacklist = new ArrayList<>();

    // --- PALABRAS CLAVE PROHIBIDAS (Filtro de Contenido) ---
    private final List<String> blacklistedWords = Arrays.asList(
        "porno", "juegos", "casino", "armas", "gore", "sexo", "xxx", "hentai", "dating", "apuestas"
    );
    
    // --- NAVEGADORES SOPORTADOS ---
    private final List<String> browserPackages = Arrays.asList(
        "com.android.chrome", "org.mozilla.firefox", "com.opera.browser", 
        "com.microsoft.emmx", "com.sec.android.app.sbrowser"
    );

    // --- IDs DE VISTAS PARA CAPTURAR URLs ---
    private final List<String> searchActionIds = Arrays.asList(
        "com.android.chrome:id/url_bar",
        "com.android.chrome:id/line_1",
        "org.mozilla.firefox:id/mozac_browser_toolbar_url_view",
        "com.opera.browser:id/url_field"
    );

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        
        // Inicializar Firebase (Solo Realtime Database para optimizar cuotas)
        mDatabase = FirebaseDatabase.getInstance().getReference("system_analysis/blocked_attempts");
        blacklistRef = FirebaseDatabase.getInstance().getReference("configuracion_global/blacklist");

        // Cargar DeviceID desde preferencias de Capacitor
        SharedPreferences prefs = getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE);
        cachedDeviceId = prefs.getString(KEY_DEVICE_ID, "unknown_device");

        // Iniciar Sincronización de Lista Negra
        startBlacklistSync();

        // Configuración estricta de Accesibilidad
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED | AccessibilityEvent.TYPE_VIEW_CLICKED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 50;
        info.flags = AccessibilityServiceInfo.DEFAULT | 
                     AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS |
                     AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
        setServiceInfo(info);
        
        Log.d(TAG, "MonitorService Conectado - Modo Sin VPN");
    }

    private void startBlacklistSync() {
        blacklistRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot snapshot) {
                dynamicBlacklist.clear();
                for (DataSnapshot domainSnapshot : snapshot.getChildren()) {
                    String domain = domainSnapshot.child("domain").getValue(String.class);
                    if (domain != null) {
                        dynamicBlacklist.add(domain.toLowerCase());
                    }
                }
                Log.d(TAG, "Lista Negra EDUControlPro Actualizada: " + dynamicBlacklist.size() + " sitios");
            }

            @Override
            public void onCancelled(@NonNull DatabaseError error) {
                Log.e(TAG, "Error en Sincronización RTDB");
            }
        });
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getPackageName() == null) return;
        String packageName = event.getPackageName().toString().toLowerCase();

        // Filtrar solo eventos de navegadores para no sobrecargar el CPU
        if (browserPackages.contains(packageName)) {
            int eventType = event.getEventType();
            if (eventType == AccessibilityEvent.TYPE_VIEW_CLICKED || 
                eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                validateAndProtectNavigation();
            }
        }
    }

    private void validateAndProtectNavigation() {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;

        for (String viewId : searchActionIds) {
            List<AccessibilityNodeInfo> nodes = rootNode.findAccessibilityNodeInfosByViewId(viewId);
            if (nodes != null && !nodes.isEmpty()) {
                AccessibilityNodeInfo searchNode = nodes.get(0);
                CharSequence rawText = searchNode.getText();
                String searchText = (rawText != null) ? rawText.toString().toLowerCase().trim() : "";

                if (isForbidden(searchText)) {
                    // Acción de Bloqueo: Reportar y Cerrar
                    sendSecurityReport(searchText);
                    
                    // Limpiar el texto de la barra (Capa de Seguridad Estudiantil)
                    Bundle args = new Bundle();
                    args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "");
                    searchNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                    
                    // Expulsar al usuario de la navegación prohibida
                    performGlobalAction(GLOBAL_ACTION_HOME);
                    Log.w(TAG, "Bloqueo Centinela ejecutado para: " + searchText);
                    break;
                }
                searchNode.recycle();
            }
        }
        rootNode.recycle();
    }

    private void sendSecurityReport(String url) {
        if (mDatabase == null) return;

        Map<String, Object> log = new HashMap<>();
        log.put("deviceId", cachedDeviceId);
        log.put("url", url);
        log.put("timestamp", ServerValue.TIMESTAMP);
        log.put("status", "blocked");

        mDatabase.push().setValue(log);
    }

    private boolean isForbidden(String text) {
        if (text == null || text.isEmpty()) return false;

        // Comprobación contra palabras estáticas
        for (String word : blacklistedWords) {
            if (text.contains(word)) return true;
        }

        // Comprobación contra dominios dinámicos (Dashboard)
        for (String domain : dynamicBlacklist) {
            if (text.contains(domain)) return true;
        }

        return false;
    }

    @Override public void onInterrupt() {}
}