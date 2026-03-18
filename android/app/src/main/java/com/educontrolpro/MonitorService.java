package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;

import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ServerValue;
import com.google.firebase.database.ValueEventListener;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class MonitorService extends AccessibilityService {
    private static final String TAG = "MonitorService";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_DEVICE_ID = "deviceId";

    private DatabaseReference mDatabase;
    private String deviceDocId;
    private boolean adminMode = false;
    private final Set<String> whiteList = new HashSet<>();
    private String ultimoTextoIngresado = "";
    private String paqueteNavegadorActual = "";
    private long ultimaExpulsionTime = 0;
    private static final long EXPULSION_COOLDOWN = 2000;

    @Override
    public void onCreate() {
        super.onCreate();
        mDatabase = FirebaseDatabase.getInstance().getReference();
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        deviceDocId = prefs.getString(KEY_DEVICE_ID, null);
        Log.d(TAG, "MonitorService iniciado. Device ID: " + deviceDocId);
        if (deviceDocId != null) {
            iniciarWhitelistListener();
            iniciarListenerControl();
        }
        logGlobal("SERVICE_CREATED", "MonitorService.onCreate()");
    }

    private void logGlobal(String tipo, String detalle) {
        try {
            DatabaseReference logRef = mDatabase.child("debug_logs_global").push();
            Map<String, Object> logEntry = new HashMap<>();
            logEntry.put("tipo", tipo);
            logEntry.put("detalle", detalle);
            logEntry.put("timestamp", System.currentTimeMillis());
            if (deviceDocId != null) {
                logEntry.put("deviceId", deviceDocId);
            }
            logRef.setValue(logEntry);
        } catch (Exception e) {
            Log.e(TAG, "Error en logGlobal: " + e.getMessage());
        }
    }

    private void iniciarWhitelistListener() {
        DatabaseReference whitelistRef = mDatabase.child("global").child("whitelist");
        whitelistRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                whiteList.clear();
                for (DataSnapshot child : snapshot.getChildren()) {
                    String url = child.getValue(String.class);
                    if (url != null) whiteList.add(url.toLowerCase().trim());
                }
                Log.d(TAG, "📋 Lista blanca actualizada: " + whiteList.size() + " sitios");
                logGlobal("WHITELIST_UPDATED", "Sitios cargados: " + whiteList.size());
            }
            @Override
            public void onCancelled(DatabaseError error) {
                Log.e(TAG, "Error cargando whitelist: " + error.getMessage());
                logGlobal("WHITELIST_ERROR", error.getMessage());
            }
        });
    }

    private void iniciarListenerControl() {
        DatabaseReference controlRef = mDatabase.child("dispositivos").child(deviceDocId).child("admin_mode_enable");
        controlRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                Boolean enabled = snapshot.getValue(Boolean.class);
                adminMode = (enabled != null && enabled);
                if (adminMode) {
                    Log.w(TAG, "🔓 MODO TÉCNICO ACTIVADO");
                    Toast.makeText(MonitorService.this, "🔓 MODO TÉCNICO", Toast.LENGTH_SHORT).show();
                } else {
                    Log.i(TAG, "🔒 Monitor activo");
                }
            }
            @Override
            public void onCancelled(DatabaseError error) {
                Log.e(TAG, "Error en listener control: " + error.getMessage());
            }
        });
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (adminMode || deviceDocId == null) return;
        int type = event.getEventType();
        String packageName = event.getPackageName() != null ? event.getPackageName().toString() : "";

        logGlobal("EVENT", "Tipo: " + type + " Paquete: " + packageName);

        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (packageName.contains("settings") || packageName.contains("com.android.settings")) {
                expulsarConMensaje("INTENTO_AJUSTES", "Acceso a configuración bloqueado");
                return;
            }
        }

        if (type == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED && esNavegador(packageName)) {
            AccessibilityNodeInfo source = event.getSource();
            if (source != null) {
                CharSequence text = source.getText();
                if (text != null && text.length() > 0) {
                    ultimoTextoIngresado = text.toString();
                    paqueteNavegadorActual = packageName;
                    logGlobal("TEXTO_CAPTURADO", "Texto: " + ultimoTextoIngresado);
                }
                source.recycle();
            }
        }

        if ((type == AccessibilityEvent.TYPE_VIEW_CLICKED ||
                type == AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED)
                && esNavegador(packageName)) {
            logGlobal("PROCESAR_BUSQUEDA", "Llamando a procesarBusqueda()");
            procesarBusqueda();
        }
    }

    private void procesarBusqueda() {
        if (ultimoTextoIngresado.isEmpty()) {
            logGlobal("PROCESAR_BUSQUEDA", "Texto vacío, ignorando");
            return;
        }
        long ahora = System.currentTimeMillis();
        if (ahora - ultimaExpulsionTime < EXPULSION_COOLDOWN) {
            logGlobal("PROCESAR_BUSQUEDA", "Cooldown activo, ignorando");
            return;
        }

        String textoLower = ultimoTextoIngresado.toLowerCase().trim();
        logGlobal("PROCESAR_BUSQUEDA", "Texto a evaluar: " + textoLower + " | Whitelist size: " + whiteList.size());

        boolean autorizado = false;
        for (String sitio : whiteList) {
            if (textoLower.contains(sitio)) {
                autorizado = true;
                logGlobal("PROCESAR_BUSQUEDA", "Coincidencia encontrada: " + sitio);
                break;
            }
        }
        if (!autorizado) {
            ultimaExpulsionTime = ahora;
            bloquearIntento(textoLower);
        } else {
            logGlobal("PROCESAR_BUSQUEDA", "Búsqueda autorizada");
        }
    }

    private void bloquearIntento(String url) {
        Log.i(TAG, "🚫 Bloqueado: " + url);
        Toast.makeText(this, "🚫 Sitio no autorizado", Toast.LENGTH_SHORT).show();
        logGlobal("BLOQUEO", "URL bloqueada: " + url);

        // Limpiar campo de búsqueda
        try {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root != null) {
                limpiarNodos(root);
                root.recycle();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error limpiando campo: " + e.getMessage());
            logGlobal("BLOQUEO_ERROR", e.getMessage());
        }

        // Reportar a Firebase
        DatabaseReference reportRef = mDatabase.child("system_analysis").child("blocked_attempts").push();
        Map<String, Object> data = new HashMap<>();
        data.put("url", url);
        data.put("deviceId", deviceDocId != null ? deviceDocId : "unknown");
        data.put("timestamp", ServerValue.TIMESTAMP);
        data.put("status", "Expulsado");
        reportRef.setValue(data);

        // Ir al escritorio
        Intent homeIntent = new Intent(Intent.ACTION_MAIN);
        homeIntent.addCategory(Intent.CATEGORY_HOME);
        homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(homeIntent);
    }

    private void limpiarNodos(AccessibilityNodeInfo node) {
        if (node == null) return;
        if (node.getClassName() != null && node.getClassName().toString().contains("EditText")) {
            node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, null);
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            limpiarNodos(node.getChild(i));
        }
    }

    private boolean esNavegador(String packageName) {
        return packageName.contains("chrome") ||
                packageName.contains("browser") ||
                packageName.contains("firefox") ||
                packageName.contains("opera") ||
                packageName.contains("edge") ||
                packageName.contains("samsung.android.app.sbrowser") ||
                packageName.contains("com.android.chrome");
    }

    @Override
    public void onInterrupt() {
        logGlobal("SERVICE_INTERRUPT", "onInterrupt()");
    }

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED |
                AccessibilityEvent.TYPE_VIEW_CLICKED |
                AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED |
                AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
        info.notificationTimeout = 100;
        setServiceInfo(info);
        Log.d(TAG, "MonitorService configurado");
        logGlobal("SERVICE_CONNECTED", "MonitorService configurado");
    }

    private void expulsarConMensaje(String tipo, String descripcion) {
        Log.w(TAG, "EXPULSIÓN: " + tipo + " - " + descripcion);
        Toast.makeText(this, "🚫 ACCESO PROHIBIDO", Toast.LENGTH_SHORT).show();
        logGlobal("EXPULSION", tipo + " - " + descripcion);
        Intent homeIntent = new Intent(Intent.ACTION_MAIN);
        homeIntent.addCategory(Intent.CATEGORY_HOME);
        homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(homeIntent);
        new android.os.Handler().postDelayed(() -> {
            try {
                AccessibilityNodeInfo root = getRootInActiveWindow();
                if (root != null) {
                    limpiarNodos(root);
                    root.recycle();
                }
            } catch (Exception e) {
                Log.e(TAG, "Error limpiando campo: " + e.getMessage());
            }
        }, 500);
    }
}