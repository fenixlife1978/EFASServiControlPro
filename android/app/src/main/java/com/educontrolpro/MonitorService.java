package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.core.app.NotificationCompat;

import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.FieldValue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MonitorService extends AccessibilityService {

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private String deviceDocId;
    private String InstitutoId;
    private String alumnoAsignado = "";
    
    private static final String CAPACITOR_PREFS = "CapacitorStorage"; 
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String CHANNEL_ID = "EDU_Service_Channel";

    private boolean adminMode = false; // Control del Switch del Dashboard
    private List<String> blacklistApps = new ArrayList<>();
    
    private List<String> listaBlancaSistema = Arrays.asList(
        "com.android.packageinstaller", "com.google.android.packageinstaller",
        "com.educontrolpro", "com.android.systemui", "com.android.launcher3"
    );

    private List<String> packagesSettings = Arrays.asList(
        "com.android.settings", "com.google.android.settings", "com.samsung.android.settings"
    );

    private static final List<String> PALABRAS_PROHIBIDAS = Arrays.asList(
        "xxx", "porno", "sexo", "xvideos", "casino", "gore"
    );

    private ListenerRegistration deviceListener;
    private Handler heartbeatHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(1, getNotification());
        cargarIdentidad();
    }

    private void cargarIdentidad() {
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        deviceDocId = capPrefs.getString(KEY_DEVICE_ID, null);
        InstitutoId = capPrefs.getString("InstitutoId", null);
        
        if (deviceDocId != null) {
            db.collection("dispositivos").document(deviceDocId).get()
                .addOnSuccessListener(doc -> {
                    if (doc.exists()) {
                        alumnoAsignado = doc.getString("alumno_asignado");
                        if (alumnoAsignado == null) alumnoAsignado = "";
                    }
                });
        }
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        if (deviceDocId != null) {
            iniciarListeners(deviceDocId);
            iniciarHeartbeat();
        }
    }

    private void iniciarListeners(String docId) {
        // ESCUCHA DEL DISPOSITIVO (Incluye el Switch de Modo Técnico y Blacklist)
        deviceListener = db.collection("dispositivos").document(docId)
            .addSnapshotListener((snapshot, e) -> {
                if (snapshot != null && snapshot.exists()) {
                    // Actualizar Modo Técnico
                    Boolean mode = snapshot.getBoolean("admin_mode_enable");
                    this.adminMode = (mode != null && mode);
                    
                    // Actualizar Blacklist
                    this.blacklistApps = (List<String>) snapshot.get("blacklistApps");
                    if (this.blacklistApps == null) this.blacklistApps = new ArrayList<>();
                    
                    Log.d("EDU_Monitor", "Estado actualizado - Modo Técnico: " + this.adminMode);
                }
            });
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // REGLA DE ORO 1: Si el técnico activó el switch, el centinela no interviene
        if (adminMode) return;

        String packageName = event.getPackageName() != null ? event.getPackageName().toString() : "";
        int eventType = event.getEventType();

        // A. BLOQUEO DE AJUSTES Y APPS
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (listaBlancaSistema.contains(packageName)) return;

            if (packagesSettings.contains(packageName)) {
                reportarYExpulsar("INTENTO_AJUSTES", "Acceso a ajustes", packageName, null);
                return;
            }

            if (blacklistApps.contains(packageName)) {
                reportarYExpulsar("APP_PROHIBIDA", "App restringida", packageName, null);
                return;
            }
        }

        // B. MONITOREO DE NAVEGACIÓN (Regla de Oro: Solo al ejecutar/cambiar)
        if (esNavegador(packageName)) {
            // Ignoramos TYPE_VIEW_TEXT_CHANGED para no molestar mientras escriben
            if (eventType == AccessibilityEvent.TYPE_VIEW_CLICKED || 
                eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
                
                AccessibilityNodeInfo rootNode = getRootInActiveWindow();
                if (rootNode == null) return;
                analizarYFiltrar(rootNode);
                rootNode.recycle();
            }
        }
    }

    private void analizarYFiltrar(AccessibilityNodeInfo node) {
        if (node == null) return;

        // Si es un campo de texto (Barra de búsqueda o URL)
        if (node.getClassName() != null && node.getClassName().toString().contains("EditText")) {
            CharSequence text = node.getText();
            if (text != null) {
                String input = text.toString().toLowerCase();
                for (String word : PALABRAS_PROHIBIDAS) {
                    if (input.contains(word)) {
                        // REGLA DE ORO: Limpiar campo, reportar y expulsar
                        limpiarCampo(node);
                        reportarYExpulsar("BUSQUEDA_PROHIBIDA", "Palabra bloqueada: " + word, input, node);
                        return;
                    }
                }
                // Si no es prohibido, actualizamos la URL actual en el dashboard
                actualizarUrlActual(input);
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                analizarYFiltrar(child);
                child.recycle();
            }
        }
    }

    private void limpiarCampo(AccessibilityNodeInfo node) {
        if (node != null && node.isEditable()) {
            Bundle arguments = new Bundle();
            arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "");
            node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
        }
    }

    private void actualizarUrlActual(String url) {
        if (deviceDocId != null && url.length() > 3) {
            Map<String, Object> data = new HashMap<>();
            data.put("url_actual", url);
            data.put("ultimoAcceso", FieldValue.serverTimestamp());
            db.collection("dispositivos").document(deviceDocId).update(data);
        }
    }

    private void reportarYExpulsar(String tipo, String desc, String detalle, AccessibilityNodeInfo node) {
        // 1. Expulsar al Home
        performGlobalAction(GLOBAL_ACTION_HOME);

        // 2. Reportar Alerta
        Map<String, Object> alerta = new HashMap<>();
        alerta.put("tipo", tipo);
        alerta.put("descripcion", desc);
        alerta.put("detalle", detalle);
        alerta.put("timestamp", FieldValue.serverTimestamp());
        alerta.put("deviceId", deviceDocId);
        alerta.put("alumno", alumnoAsignado);
        db.collection("alertas").add(alerta);

        // 3. Guardar en historial web (Subcolección)
        Map<String, Object> hist = new HashMap<>();
        hist.put("url", detalle);
        hist.put("bloqueado", true);
        hist.put("timestamp", FieldValue.serverTimestamp());
        db.collection("dispositivos").document(deviceDocId).collection("web_history").add(hist);
    }

    private boolean esNavegador(String pkg) {
        List<String> navs = Arrays.asList("chrome", "browser", "firefox", "edge", "opera");
        for (String n : navs) if (pkg.toLowerCase().contains(n)) return true;
        return false;
    }

    private void iniciarHeartbeat() {
        heartbeatHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (deviceDocId != null) {
                    db.collection("dispositivos").document(deviceDocId).update("online", true, "ultimoAcceso", FieldValue.serverTimestamp());
                }
                heartbeatHandler.postDelayed(this, 30000);
            }
        }, 30000);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Centinela EDU", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private Notification getNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EDU Centinela Activo")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setOngoing(true).build();
    }

    @Override public void onInterrupt() {}
    @Override
    public void onDestroy() {
     
        if (deviceListener != null) deviceListener.remove();
     
        super.onDestroy();
    }
}
