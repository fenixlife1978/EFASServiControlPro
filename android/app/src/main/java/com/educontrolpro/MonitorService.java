
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
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.core.app.NotificationCompat;

import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MonitorService extends AccessibilityService {
 
    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    
    // VARIABLES DE IDENTIDAD
    private String deviceDocId;
    private String InstitutoId;
    private String aulaId;
    private String seccion;
    private String nombreInstituto;
    private String alumnoAsignado = "";
    
    private static final String PREFS_NAME = "AdminPrefs";
    private static final String CAPACITOR_PREFS = "CapacitorStorage"; 
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String CHANNEL_ID = "EDU_Service_Channel";

    // VARIABLES DE ESTADO Y COMANDOS
    private boolean allowAccess = false; // Control remoto para técnicos
    private boolean shieldMode = false;
    private boolean useBlacklist = false;
    private boolean useWhitelist = false;
    private List<String> listaNegra = new ArrayList<>();
    private List<String> whitelist = new ArrayList<>();
    
    // Apps del sistema que siempre deben permitirse para no romper el OS
    private List<String> listaBlancaSistema = Arrays.asList(
        "com.android.packageinstaller",
        "com.google.android.packageinstaller",
        "com.educontrolpro",
        "com.android.systemui",
        "com.android.launcher3",
        "com.google.android.inputmethod.latin"
    );

    // Ajustes del dispositivo (Prohibidos para el alumno)
    private List<String> packagesSettings = Arrays.asList(
        "com.android.settings",
        "com.google.android.settings",
        "com.samsung.android.settings",
        "com.miui.securitycenter"
    );

    // Palabras prohibidas para búsquedas
    private static final List<String> PALABRAS_PROHIBIDAS = Arrays.asList(
        "xxx", "porno", "sexo", "juegos", "hack", "casino", "gore"
    );

    // Listeners
    private ListenerRegistration deviceListener;
    private ListenerRegistration techListener;
    private ListenerRegistration institutionListener;

    private Handler heartbeatHandler = new Handler(Looper.getMainLooper());
    private Runnable heartbeatRunnable;
    private static final long HEARTBEAT_INTERVAL = 30000;

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
   
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(CHANNEL_ID, "Monitoreo EDU", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(serviceChannel);
        }
    }
   
    private Notification getNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EDUControlPro Activo")
                .setContentText("Protección de sistema activa")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
    }
  
    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        if (deviceDocId != null) {
            iniciarListeners(deviceDocId);
            iniciarHeartbeat();
        }
    }

    private void iniciarHeartbeat() {
        heartbeatRunnable = new Runnable() {
            @Override
            public void run() {
                if (deviceDocId != null) {
                    Map<String, Object> heartbeat = new HashMap<>();
                    heartbeat.put("online", true);
                    heartbeat.put("ultimoAcceso", FieldValue.serverTimestamp());
                    db.collection("dispositivos").document(deviceDocId).update(heartbeat);
                }
                heartbeatHandler.postDelayed(this, HEARTBEAT_INTERVAL);
            }
        };
        heartbeatHandler.post(heartbeatRunnable);
    }
    
    private void iniciarListeners(String docId) {
        // 1. CONTROL DE TÉCNICO (allowAccess)
        techListener = db.collection("devices").document(docId).collection("settings").document("remote")
            .addSnapshotListener((snapshot, e) -> {
                if (snapshot != null && snapshot.exists()) {
                    Boolean allow = snapshot.getBoolean("allowAccess");
                    this.allowAccess = (allow != null && allow);
                    Log.d("EDU_Monitor", "Modo Técnico: " + this.allowAccess);
                }
            });

        // 2. CONFIGURACIÓN DEL DISPOSITIVO
        deviceListener = db.collection("dispositivos").document(docId)
            .addSnapshotListener((snapshot, e) -> {
                if (snapshot != null && snapshot.exists()) {
                    Boolean shield = snapshot.getBoolean("shieldMode");
                    this.shieldMode = (shield != null && shield);
                    
                    // Si allowAccess no está en la ruta anterior, lo buscamos aquí también como fallback
                    Boolean allow = snapshot.getBoolean("allowAccess");
                    if (allow != null) this.allowAccess = allow;
                }
            });

        // 3. REGLAS DE LA INSTITUCIÓN
        if (InstitutoId != null) {
            institutionListener = db.collection("institutions").document(InstitutoId)
                .addSnapshotListener((snapshot, e) -> {
                    if (snapshot != null && snapshot.exists()) {
                        this.useBlacklist = snapshot.getBoolean("useBlacklist") != null && snapshot.getBoolean("useBlacklist");
                        this.listaNegra = (List<String>) snapshot.get("blacklist");
                        if (this.listaNegra == null) this.listaNegra = new ArrayList<>();
                    }
                });
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (allowAccess) return; // Si el técnico tiene acceso, no bloqueamos nada

        String packageName = event.getPackageName() != null ? event.getPackageName().toString() : "";
        int eventType = event.getEventType();

        // A. BLOQUEO DE APPS Y AJUSTES (Al abrir la ventana)
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            // Bloqueo de Ajustes
            if (packagesSettings.contains(packageName)) {
                reportarYExpulsar("INTENTO_AJUSTES", "Acceso denegado a configuraciones", packageName);
                return;
            }

            // Bloqueo de Apps Prohibidas (Blacklist de paquetes)
            if (useBlacklist && listaNegra.contains(packageName)) {
                reportarYExpulsar("APP_PROHIBIDA", "Intento de abrir aplicación restringida", packageName);
                return;
            }
        }

        // B. MONITOREO DE NAVEGADORES (Búsquedas prohibidas)
        if (esNavegador(packageName)) {
            analizarContenidoNavegador(event);
        }
    }

    private boolean esNavegador(String pkg) {
        String p = pkg.toLowerCase();
        return p.contains("chrome") || p.contains("browser") || p.contains("firefox") || p.contains("edge");
    }

    private void analizarContenidoNavegador(AccessibilityEvent event) {
        AccessibilityNodeInfo node = event.getSource();
        if (node == null) return;

        // Buscamos campos de texto (Omnibox o buscadores)
        buscarYValidarNodos(node);
    }

    private void buscarYValidarNodos(AccessibilityNodeInfo node) {
        if (node == null) return;

        if (node.getClassName() != null && node.getClassName().toString().contains("EditText")) {
            CharSequence text = node.getText();
            if (text != null) {
                String input = text.toString().toLowerCase();
                for (String word : PALABRAS_PROHIBIDAS) {
                    if (input.contains(word)) {
                        // Si detectamos la palabra, verificamos si es una acción de confirmar/enviar
                        reportarYExpulsar("BUSQUEDA_PROHIBIDA", "Término restringido: " + word, input);
                        return;
                    }
                }
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            buscarYValidarNodos(node.getChild(i));
        }
    }

    private void reportarYExpulsar(String tipo, String desc, String detalle) {
        Log.w("EDU_Monitor", "🔒 BLOQUEO: " + desc);
        
        // 1. Expulsar al escritorio (Home)
        performGlobalAction(GLOBAL_ACTION_HOME);

        // 2. Reportar a Firebase
        if (deviceDocId != null) {
            Map<String, Object> alerta = new HashMap<>();
            alerta.put("tipo", tipo);
            alerta.put("descripcion", desc);
            alerta.put("detalle", detalle);
            alerta.put("timestamp", FieldValue.serverTimestamp());
            alerta.put("deviceId", deviceDocId);
            alerta.put("InstitutoId", InstitutoId);
            alerta.put("alumno", alumnoAsignado);
            alerta.put("status", "nuevo");

            db.collection("alertas").add(alerta);
        }
    }

    @Override
    public void onInterrupt() {}

    @Override
    public void onDestroy() {
        if (techListener != null) techListener.remove();
        if (deviceListener != null) deviceListener.remove();
        if (institutionListener != null) institutionListener.remove();
        super.onDestroy();
    }
}
