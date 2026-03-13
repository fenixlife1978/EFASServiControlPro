package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
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
    private String deviceDocId, InstitutoId, alumnoAsignado = "";

    private static final String PREFS_NAME = "AdminPrefs";
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String CHANNEL_ID = "EDU_Service_Channel";

    private boolean shieldMode = false;
    private boolean useBlacklist = false, whitelistOnly = false, blockAllBrowsing = false;
    private List<String> listaNegra = new ArrayList<>(), whitelist = new ArrayList<>();
    
    private long lastBlockTime = 0;
    private static final long BLOCK_COOLDOWN = 2000;
    private String ultimaUrlReportada = "";

    // Blindaje de apps críticas para evitar que el alumno bloquee el sistema
    private final List<String> listaBlancaSistema = Arrays.asList(
            "com.android.packageinstaller", "com.google.android.packageinstaller", 
            "com.educontrolpro", "com.android.systemui", "com.android.settings"
    );

    private final List<String> PALABRAS_PROHIBIDAS = Arrays.asList(
            "xxx", "porno", "videos pornos", "casino", "bet", "poker", "torrent", "vpn", "proxy"
    );

    private ListenerRegistration deviceListener, institutionListener;
    private Handler heartbeatHandler = new Handler(Looper.getMainLooper());
    private Runnable heartbeatRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        // Notificación de baja prioridad para ser "invisible" en la barra
        startForeground(1, getNotification());
        cargarIdentidad();
    }

    private void cargarIdentidad() {
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        deviceDocId = capPrefs.getString("deviceId", null);
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

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Sistema de Protección", NotificationManager.IMPORTANCE_MIN);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification getNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EduControlPro")
                .setContentText("Servicio de protección activo")
                .setSmallIcon(android.R.drawable.ic_secure) // Icono más discreto
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setOngoing(true)
                .build();
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        if (deviceDocId != null && InstitutoId != null) {
            iniciarListeners(deviceDocId, InstitutoId);
            iniciarHeartbeat();
        }
    }

    private void iniciarHeartbeat() {
        heartbeatRunnable = new Runnable() {
            @Override
            public void run() {
                if (deviceDocId != null) {
                    db.collection("dispositivos").document(deviceDocId)
                            .update("online", true, "ultimoAcceso", FieldValue.serverTimestamp());
                }
                heartbeatHandler.postDelayed(this, 60000); // 1 minuto es suficiente para batería
            }
        };
        heartbeatHandler.post(heartbeatRunnable);
    }

    private void iniciarListeners(String docId, String instId) {
        deviceListener = db.collection("dispositivos").document(docId)
                .addSnapshotListener((snapshot, e) -> {
                    if (snapshot != null && snapshot.exists()) {
                        shieldMode = Boolean.TRUE.equals(snapshot.getBoolean("shieldMode"));
                        if (Boolean.TRUE.equals(snapshot.getBoolean("bloquear"))) {
                            dispararBloqueo("BLOQUEO_REMOTO", "Desde Panel Administrativo");
                            db.collection("dispositivos").document(docId).update("bloquear", false);
                        }
                    }
                });

        institutionListener = db.collection("institutions").document(instId)
                .addSnapshotListener((snapshot, e) -> {
                    if (snapshot != null && snapshot.exists()) {
                        blockAllBrowsing = Boolean.TRUE.equals(snapshot.getBoolean("blockAllBrowsing"));
                        useBlacklist = Boolean.TRUE.equals(snapshot.getBoolean("useBlacklist"));
                        whitelistOnly = Boolean.TRUE.equals(snapshot.getBoolean("whitelistOnly"));
                        listaNegra = (List<String>) snapshot.get("blacklist");
                        whitelist = (List<String>) snapshot.get("whitelist");
                    }
                });
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        String packageName = (event.getPackageName() != null) ? event.getPackageName().toString() : "";
        
        // No auto-bloquearnos
        if (packageName.equals("com.educontrolpro")) return;

        // Bloqueo de Ajustes (Exclusivo si no está desbloqueado por PIN Maestro)
        if (packageName.equals("com.android.settings") || packageName.contains("settings")) {
            boolean isUnlocked = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getBoolean(KEY_UNLOCKED, false);
            if (!isUnlocked) {
                dispararBloqueo("RESTRICCION_AJUSTES", "Acceso a configuración no autorizado");
                return;
            }
        }

        // Análisis de navegación y contenido
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode != null) {
            analizarNodo(rootNode);
            rootNode.recycle(); // Crucial para liberar memoria
        }
    }

    private void analizarNodo(AccessibilityNodeInfo node) {
        if (node == null) return;

        // 1. Identificar Barras de URL (Chrome, Samsung, Brave)
        String resId = node.getViewIdResourceName();
        if (resId != null && (resId.contains("url_bar") || resId.contains("location_bar") || resId.contains("search_box"))) {
            if (node.getText() != null) {
                procesarUrl(node.getText().toString());
            }
        }

        // 2. Escaneo de palabras prohibidas en el texto visible
        if (node.getText() != null) {
            String texto = node.getText().toString().toLowerCase();
            for (String palabra : PALABRAS_PROHIBIDAS) {
                if (texto.contains(palabra)) {
                    dispararBloqueo("CONTENIDO_PROHIBIDO", "Detectado: " + palabra);
                    return;
                }
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            analizarNodo(node.getChild(i));
        }
    }

    private void procesarUrl(String url) {
        String limpia = url.toLowerCase().trim().replaceAll("https?://(www\\.)?", "");
        if (limpia.length() < 3 || limpia.contains("google.com/search")) return;

        boolean bloquear = false;
        if (blockAllBrowsing) bloquear = true;
        else if (whitelistOnly && !estaEnLista(limpia, whitelist)) bloquear = true;
        else if (useBlacklist && estaEnLista(limpia, listaNegra)) bloquear = true;

        if (bloquear) {
            dispararBloqueo("WEB_BLOCK", limpia);
        } else {
            reportarNavegacion(limpia);
        }
    }

    private boolean estaEnLista(String url, List<String> lista) {
        if (lista == null) return false;
        for (String item : lista) {
            if (url.contains(item.toLowerCase())) return true;
        }
        return false;
    }

    private synchronized void dispararBloqueo(String tipo, String detalle) {
        if (System.currentTimeMillis() - lastBlockTime < BLOCK_COOLDOWN) return;
        
        lastBlockTime = System.currentTimeMillis();
        SimpleLogger.w("Bloqueo: " + tipo + " -> " + detalle);

        Intent lockIntent = new Intent(this, LockActivity.class);
        lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        lockIntent.putExtra("tipo_bloqueo", tipo);
        lockIntent.putExtra("sitio_bloqueado", detalle);
        startActivity(lockIntent);

        reportarIncidencia(tipo, detalle);
    }

    private void reportarNavegacion(String url) {
        if (url.equals(ultimaUrlReportada)) return;
        ultimaUrlReportada = url;
        
        Map<String, Object> data = new HashMap<>();
        data.put("url", url);
        data.put("timestamp", FieldValue.serverTimestamp());
        data.put("alumno", alumnoAsignado);
        
        db.collection("web_history").add(data);
    }

    private void reportarIncidencia(String tipo, String desc) {
        if (deviceDocId == null) return;
        Map<String, Object> inc = new HashMap<>();
        inc.put("tipo", tipo);
        inc.put("descripcion", desc);
        inc.put("timestamp", FieldValue.serverTimestamp());
        db.collection("dispositivos").document(deviceDocId).collection("incidencias").add(inc);
    }

    @Override public void onInterrupt() {}

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (deviceListener != null) deviceListener.remove();
        if (institutionListener != null) institutionListener.remove();
        heartbeatHandler.removeCallbacks(heartbeatRunnable);
    }
}