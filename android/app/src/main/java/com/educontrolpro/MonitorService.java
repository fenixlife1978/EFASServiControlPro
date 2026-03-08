package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
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
    
    private String deviceDocId;
    private String InstitutoId;
    private String aulaId;
    private String seccion;
    private String nombreInstituto;
    private String alumnoAsignado = "";
    
    private static final String PREFS_NAME = "AdminPrefs";
    private static final String CAPACITOR_PREFS = "CapacitorStorage"; 
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_MASTER_PIN = "master_pin"; 
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String CHANNEL_ID = "EDU_Service_Channel";
    private static final String ACTION_CLOSE_LOCK = "ACTION_CLOSE_LOCK";

    private boolean shieldMode = false;
    private boolean useBlacklist = false;
    private boolean blockAllBrowsing = false;
    private boolean cortarNavegacion = false;
    private String bloqueoPin = "";
    private List<String> listaNegra = new ArrayList<>();
    
    private List<String> listaBlancaSistema = Arrays.asList(
        "com.android.packageinstaller",
        "com.google.android.packageinstaller",
        "com.educontrolpro",
        "com.android.systemui",
        "com.google.android.googlequicksearchbox"
    );

    private ListenerRegistration deviceListener;
    private ListenerRegistration institutionListener;
    private ListenerRegistration securityListener;

    private Handler heartbeatHandler = new Handler(Looper.getMainLooper());
    private Runnable heartbeatRunnable;
    private static final long HEARTBEAT_INTERVAL = 30000;

    private String ultimaUrlReportada = "";
    
    private BroadcastReceiver closeLockReceiver;

    // Método para guardar errores en Firestore
    private void guardarErrorEnFirestore(String lugar, Exception e) {
        if (deviceDocId == null) return;
        
        Map<String, Object> errorData = new HashMap<>();
        errorData.put("deviceId", deviceDocId);
        errorData.put("lugar", lugar);
        errorData.put("mensaje", e.getMessage());
        errorData.put("stacktrace", Log.getStackTraceString(e));
        errorData.put("timestamp", FieldValue.serverTimestamp());
        
        db.collection("error_logs").add(errorData)
            .addOnFailureListener(err -> Log.e("EDU_Monitor", "No se pudo guardar error en Firestore", err));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d("EDU_Monitor", "✅ onCreate: Servicio creado");
        
        try {
            closeLockReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (ACTION_CLOSE_LOCK.equals(intent.getAction())) {
                        Log.d("EDU_Monitor", "📡 Recibida orden de cierre automático");
                    }
                }
            };
            registerReceiver(closeLockReceiver, new IntentFilter(ACTION_CLOSE_LOCK));
            
            createNotificationChannel();
            startForeground(1, getNotification());
            cargarIdentidad();
        } catch (Exception e) {
            Log.e("EDU_Monitor", "❌ Error en onCreate", e);
            guardarErrorEnFirestore("onCreate", e);
        }
    }

    private void cargarIdentidad() {
        try {
            Log.d("EDU_Monitor", "📥 cargarIdentidad: Leyendo preferencias");
            SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
            deviceDocId     = capPrefs.getString("deviceId", null);
            InstitutoId     = capPrefs.getString("InstitutoId", null);
            aulaId          = capPrefs.getString("aulaId", null);
            seccion         = capPrefs.getString("seccion", null);
            nombreInstituto = capPrefs.getString("nombreInstituto", null);

            Log.d("EDU_Monitor", "📱 deviceDocId: " + deviceDocId);
            Log.d("EDU_Monitor", "🏫 InstitutoId: " + InstitutoId);
            Log.d("EDU_Monitor", "📚 aulaId: " + aulaId);
            Log.d("EDU_Monitor", "📝 seccion: " + seccion);

            if (deviceDocId == null || InstitutoId == null) {
                Log.w("EDU_Monitor", "⚠️ Faltan datos críticos, intentando desde AdminPrefs");
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                deviceDocId = prefs.getString(KEY_DEVICE_ID, null);
            }
            
            if (deviceDocId != null) {
                db.collection("dispositivos").document(deviceDocId).get()
                    .addOnSuccessListener(doc -> {
                        try {
                            if (doc.exists()) {
                                alumnoAsignado = doc.getString("alumno_asignado");
                                if (alumnoAsignado == null) alumnoAsignado = "";
                                Log.d("EDU_Monitor", "👤 alumnoAsignado: " + alumnoAsignado);
                            }
                        } catch (Exception e) {
                            Log.e("EDU_Monitor", "❌ Error en callback de alumno", e);
                            guardarErrorEnFirestore("cargarIdentidad/callbackAlumno", e);
                        }
                    })
                    .addOnFailureListener(e -> {
                        Log.e("EDU_Monitor", "❌ Error obteniendo alumno", e);
                        guardarErrorEnFirestore("cargarIdentidad/getAlumno", e);
                    });
            }
        } catch (Exception e) {
            Log.e("EDU_Monitor", "❌ Error en cargarIdentidad", e);
            guardarErrorEnFirestore("cargarIdentidad", e);
        }
    }

    private void createNotificationChannel() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel serviceChannel = new NotificationChannel(CHANNEL_ID, "Monitoreo Educativo", NotificationManager.IMPORTANCE_LOW);
                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) manager.createNotificationChannel(serviceChannel);
            }
        } catch (Exception e) {
            Log.e("EDU_Monitor", "❌ Error creando canal de notificación", e);
            guardarErrorEnFirestore("createNotificationChannel", e);
        }
    }

    private Notification getNotification() {
        try {
            return new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setContentTitle("EDUControlPro Activo")
                    .setContentText("Protección activa en el Instituto")
                    .setSmallIcon(android.R.drawable.ic_lock_lock)
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setOngoing(true)
                    .build();
        } catch (Exception e) {
            Log.e("EDU_Monitor", "❌ Error creando notificación", e);
            guardarErrorEnFirestore("getNotification", e);
            return null;
        }
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        Log.d("EDU_Monitor", "✅ onServiceConnected: Servicio conectado");
        
        try {
            if (deviceDocId != null && InstitutoId != null) {
                Log.d("EDU_Monitor", "✅ VINCULACIÓN EXITOSA:");
                Log.d("EDU_Monitor", "Inst: " + nombreInstituto + " (" + InstitutoId + ")");
                Log.d("EDU_Monitor", "Aula/Secc: " + aulaId + " " + seccion);
                
                iniciarListeners(deviceDocId, InstitutoId);
                iniciarHeartbeat();
                reportarEstadoInicial();
                
            } else {
                Log.e("EDU_Monitor", "❌ ERROR: Faltan datos críticos de identidad.");
                guardarErrorEnFirestore("onServiceConnected/sinIdentidad", new Exception("Faltan datos críticos"));
            }
        } catch (Exception e) {
            Log.e("EDU_Monitor", "❌ Error en onServiceConnected", e);
            guardarErrorEnFirestore("onServiceConnected", e);
        }
    }

    private void reportarEstadoInicial() {
        if (deviceDocId == null) return;
        try {
            Map<String, Object> estadoInicial = new HashMap<>();
            estadoInicial.put("online", true);
            estadoInicial.put("ultimoAcceso", FieldValue.serverTimestamp());
            estadoInicial.put("ultimaUrl", "");
            estadoInicial.put("servicioActivo", true);
            
            db.collection("dispositivos").document(deviceDocId)
                .update(estadoInicial)
                .addOnFailureListener(e -> {
                    Log.e("EDU_Monitor", "Error reportando estado inicial", e);
                    guardarErrorEnFirestore("reportarEstadoInicial", e);
                });
        } catch (Exception e) {
            Log.e("EDU_Monitor", "❌ Error en reportarEstadoInicial", e);
            guardarErrorEnFirestore("reportarEstadoInicial", e);
        }
    }

    private void iniciarHeartbeat() {
        try {
            heartbeatRunnable = new Runnable() {
                @Override
                public void run() {
                    try {
                        if (deviceDocId != null) {
                            Map<String, Object> heartbeat = new HashMap<>();
                            heartbeat.put("online", true);
                            heartbeat.put("ultimoAcceso", FieldValue.serverTimestamp());
                            
                            db.collection("dispositivos").document(deviceDocId)
                                .update(heartbeat)
                                .addOnFailureListener(e -> {
                                    Log.e("EDU_Monitor", "Error en heartbeat", e);
                                    guardarErrorEnFirestore("heartbeat", e);
                                });
                        }
                    } catch (Exception e) {
                        Log.e("EDU_Monitor", "❌ Error en heartbeat run", e);
                        guardarErrorEnFirestore("heartbeat/run", e);
                    } finally {
                        heartbeatHandler.postDelayed(this, HEARTBEAT_INTERVAL);
                    }
                }
            };
            heartbeatHandler.post(heartbeatRunnable);
            Log.d("EDU_Monitor", "💓 Heartbeat iniciado");
        } catch (Exception e) {
            Log.e("EDU_Monitor", "❌ Error iniciando heartbeat", e);
            guardarErrorEnFirestore("iniciarHeartbeat", e);
        }
    }

    private void iniciarListeners(String docId, String instId) {
        try {
            deviceListener = db.collection("dispositivos").document(docId)
                .addSnapshotListener((snapshot, e) -> {
                    if (e != null) {
                        Log.e("EDU_Monitor", "Error en listener de dispositivo", e);
                        guardarErrorEnFirestore("deviceListener", e);
                        return;
                    }
                    try {
                        if (snapshot != null && snapshot.exists()) {
                            Log.d("EDU_Monitor", "📡 Cambio detectado en dispositivo");
                            procesarCambiosDispositivo(snapshot);
                        }
                    } catch (Exception ex) {
                        Log.e("EDU_Monitor", "❌ Error procesando cambio dispositivo", ex);
                        guardarErrorEnFirestore("deviceListener/procesar", ex);
                    }
                });

            institutionListener = db.collection("institutions").document(instId)
                .addSnapshotListener((snapshot, e) -> {
                    if (e != null) {
                        Log.e("EDU_Monitor", "Error en listener de institución", e);
                        guardarErrorEnFirestore("institutionListener", e);
                        return;
                    }
                    try {
                        if (snapshot != null && snapshot.exists()) {
                            Log.d("EDU_Monitor", "🏛️ Cambio detectado en institución");
                            procesarCambiosInstitucion(snapshot);
                        }
                    } catch (Exception ex) {
                        Log.e("EDU_Monitor", "❌ Error procesando cambio institución", ex);
                        guardarErrorEnFirestore("institutionListener/procesar", ex);
                    }
                });

            securityListener = db.collection("system_config").document("security")
                .addSnapshotListener((snapshot, e) -> {
                    if (e != null) {
                        Log.e("EDU_Monitor", "Error en listener de seguridad", e);
                        guardarErrorEnFirestore("securityListener", e);
                        return;
                    }
                    try {
                        if (snapshot != null && snapshot.exists()) {
                            String pin = snapshot.getString("master_pin");
                            if (pin != null && !pin.isEmpty()) {
                                saveMasterPin(pin);
                            }
                        }
                    } catch (Exception ex) {
                        Log.e("EDU_Monitor", "❌ Error procesando cambio seguridad", ex);
                        guardarErrorEnFirestore("securityListener/procesar", ex);
                    }
                });
            
            Log.d("EDU_Monitor", "👂 Listeners iniciados");
        } catch (Exception e) {
            Log.e("EDU_Monitor", "❌ Error iniciando listeners", e);
            guardarErrorEnFirestore("iniciarListeners", e);
        }
    }

    private void procesarCambiosDispositivo(DocumentSnapshot snapshot) {
        try {
            Boolean adminEnabled = snapshot.getBoolean("admin_mode_enable");
            Boolean shield = snapshot.getBoolean("shieldMode");
            Boolean cortarNavegacionCmd = snapshot.getBoolean("cortarNavegacion");
            Boolean bloquearCmd = snapshot.getBoolean("bloquear");
            String pinCmd = snapshot.getString("pinBloqueo");
            String nuevoAlumno = snapshot.getString("alumno_asignado");
            
            if (nuevoAlumno != null && !nuevoAlumno.isEmpty()) {
                alumnoAsignado = nuevoAlumno;
            }
            
            this.shieldMode = (shield != null && shield);
            this.cortarNavegacion = (cortarNavegacionCmd != null && cortarNavegacionCmd);
            
            if (pinCmd != null && !pinCmd.isEmpty()) {
                this.bloqueoPin = pinCmd;
                saveUnlockPin(pinCmd);
                Log.d("EDU_Monitor", "PIN de bloqueo actualizado");
            }
            
            saveUnlockState(adminEnabled != null && adminEnabled);
            
            if (bloquearCmd != null && bloquearCmd) {
                Log.d("EDU_Monitor", "Comando BLOQUEAR recibido");
                dispararBloqueoConDuracion(7000);
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    try {
                        if (deviceDocId != null) {
                            db.collection("dispositivos").document(deviceDocId)
                                .update("bloquear", false);
                        }
                    } catch (Exception ex) {
                        Log.e("EDU_Monitor", "Error reseteando comando bloquear", ex);
                        guardarErrorEnFirestore("procesarCambiosDispositivo/resetBloquear", ex);
                    }
                }, 2000);
            }
            
            if (this.shieldMode || (adminEnabled != null && !adminEnabled)) {
                dispararBloqueoConDuracion(7000);
            }
        } catch (Exception e) {
            Log.e("EDU_Monitor", "❌ Error en procesarCambiosDispositivo", e);
            guardarErrorEnFirestore("procesarCambiosDispositivo", e);
        }
    }

    private void procesarCambiosInstitucion(DocumentSnapshot snapshot) {
        try {
            Boolean blockAll = snapshot.getBoolean("blockAllBrowsing");
            Boolean useBlacklistFlag = snapshot.getBoolean("useBlacklist");
            List<String> blacklist = (List<String>) snapshot.get("blacklist");
            
            this.blockAllBrowsing = (blockAll != null && blockAll);
            
            if (useBlacklistFlag != null && useBlacklistFlag && blacklist != null) {
                this.listaNegra = blacklist;
            } else {
                this.listaNegra = new ArrayList<>();
            }
        } catch (Exception e) {
            Log.e("EDU_Monitor", "❌ Error en procesarCambiosInstitucion", e);
            guardarErrorEnFirestore("procesarCambiosInstitucion", e);
        }
    }

    private void saveUnlockPin(String pin) {
        try {
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putString("bloqueo_pin", pin)
                .apply();
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error guardando PIN", e);
            guardarErrorEnFirestore("saveUnlockPin", e);
        }
    }

    private void saveMasterPin(String pin) {
        try {
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putString(KEY_MASTER_PIN, pin).apply();
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error guardando master PIN", e);
            guardarErrorEnFirestore("saveMasterPin", e);
        }
    }

    private void saveUnlockState(boolean isUnlocked) {
        try {
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(KEY_UNLOCKED, isUnlocked).apply();
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error guardando estado unlock", e);
            guardarErrorEnFirestore("saveUnlockState", e);
        }
    }

    private void enviarLog(String packageName) {
        try {
            if (deviceDocId == null) {
                Log.e("EDU_Monitor", "❌ enviarLog: deviceDocId es NULL");
                return;
            }
            
            Log.d("EDU_Monitor", "📝 enviarLog: " + packageName);
            
            Map<String, Object> log = new HashMap<>();
            log.put("deviceId", deviceDocId);
            log.put("InstitutoId", InstitutoId);
            log.put("aulaId", aulaId);
            log.put("seccion", seccion);
            log.put("app", packageName);
            log.put("timestamp", FieldValue.serverTimestamp());
            
            db.collection("activity_logs").add(log)
                .addOnSuccessListener(ref -> Log.d("EDU_Monitor", "✅ Log guardado en activity_logs"))
                .addOnFailureListener(e -> {
                    Log.e("EDU_Monitor", "❌ Error guardando log", e);
                    guardarErrorEnFirestore("enviarLog", e);
                });
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error en enviarLog", e);
            guardarErrorEnFirestore("enviarLog", e);
        }
    }

    private void reportarUrlActual(String url) {
        try {
            if (deviceDocId == null || url.equals(ultimaUrlReportada)) return;
            
            ultimaUrlReportada = url;
            
            Map<String, Object> urlData = new HashMap<>();
            urlData.put("ultimaUrl", url);
            urlData.put("ultimaUrlTimestamp", FieldValue.serverTimestamp());
            
            db.collection("dispositivos").document(deviceDocId)
                .update(urlData)
                .addOnFailureListener(e -> {
                    Log.e("EDU_Monitor", "Error reportando URL", e);
                    guardarErrorEnFirestore("reportarUrlActual/update", e);
                });
            
            Map<String, Object> history = new HashMap<>();
            history.put("deviceId", deviceDocId);
            history.put("url", url);
            history.put("timestamp", FieldValue.serverTimestamp());
            history.put("InstitutoId", InstitutoId);
            history.put("aulaId", aulaId);
            history.put("alumno", alumnoAsignado);
            
            db.collection("web_history").add(history)
                .addOnFailureListener(e -> {
                    Log.e("EDU_Monitor", "Error guardando historial", e);
                    guardarErrorEnFirestore("reportarUrlActual/history", e);
                });
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error en reportarUrlActual", e);
            guardarErrorEnFirestore("reportarUrlActual", e);
        }
    }

    private void reportarIncidencia(String tipo, String descripcion, String url) {
        try {
            if (deviceDocId == null) return;
            
            Map<String, Object> incidencia = new HashMap<>();
            incidencia.put("tipo", tipo);
            incidencia.put("descripcion", descripcion);
            incidencia.put("url", url);
            incidencia.put("timestamp", FieldValue.serverTimestamp());
            incidencia.put("resuelta", false);
            
            db.collection("dispositivos").document(deviceDocId)
                .collection("incidencias")
                .add(incidencia)
                .addOnFailureListener(e -> {
                    Log.e("EDU_Monitor", "Error reportando incidencia", e);
                    guardarErrorEnFirestore("reportarIncidencia", e);
                });
            
            reportarAlertaGlobal(tipo, descripcion, url);
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error en reportarIncidencia", e);
            guardarErrorEnFirestore("reportarIncidencia", e);
        }
    }

    private void reportarAlertaGlobal(String tipo, String descripcion, String url) {
        try {
            if (deviceDocId == null || InstitutoId == null) return;
            
            Map<String, Object> alerta = new HashMap<>();
            alerta.put("tipo", tipo);
            alerta.put("descripcion", descripcion);
            alerta.put("url", url);
            alerta.put("urlIntentada", url);
            alerta.put("timestamp", FieldValue.serverTimestamp());
            alerta.put("deviceId", deviceDocId);
            alerta.put("InstitutoId", InstitutoId);
            alerta.put("aulaId", aulaId);
            alerta.put("alumno_asignado", alumnoAsignado);
            alerta.put("estudianteNombre", alumnoAsignado);
            alerta.put("status", "nuevo");
            
            db.collection("alertas").add(alerta)
                .addOnFailureListener(e -> {
                    Log.e("EDU_Monitor", "Error reportando alerta global", e);
                    guardarErrorEnFirestore("reportarAlertaGlobal", e);
                });
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error en reportarAlertaGlobal", e);
            guardarErrorEnFirestore("reportarAlertaGlobal", e);
        }
    }

    private void dispararBloqueoConDuracion(int duracionMs) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            boolean isUnlocked = prefs.getBoolean(KEY_UNLOCKED, false);
            
            if (!isUnlocked) {
                Log.d("EDU_Monitor", "🔒 MOSTRANDO PANTALLA DE BLOQUEO (" + duracionMs/1000 + " segundos)");
                
                Intent lockIntent = new Intent(this, LockActivity.class);
                lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(lockIntent);
                
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    try {
                        Intent closeIntent = new Intent(ACTION_CLOSE_LOCK);
                        sendBroadcast(closeIntent);
                        Log.d("EDU_Monitor", "🔓 PANTALLA DE BLOQUEO CERRADA AUTOMÁTICAMENTE");
                    } catch (Exception ex) {
                        Log.e("EDU_Monitor", "Error enviando cierre de lock", ex);
                        guardarErrorEnFirestore("dispararBloqueoConDuracion/cierre", ex);
                    }
                }, duracionMs);
            }
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error en dispararBloqueoConDuracion", e);
            guardarErrorEnFirestore("dispararBloqueoConDuracion", e);
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        try {
            if (event.getPackageName() == null) return;
            String packageName = event.getPackageName().toString();
            
            Log.d("EDU_Monitor", "📱 Evento: " + packageName + " tipo: " + event.getEventType());
            
            if (listaBlancaSistema.contains(packageName)) {
                Log.d("EDU_Monitor", "✅ App en lista blanca: " + packageName);
                return;
            }
            
            if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                Log.d("EDU_Monitor", "📱 TYPE_WINDOW_STATE_CHANGED detectado");
                enviarLog(packageName);
            }
            
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            boolean isUnlocked = prefs.getBoolean(KEY_UNLOCKED, false);
            
            if (isUnlocked && !shieldMode) return;
            
            if (packageName.contains("settings")) {
                Log.d("EDU_Monitor", "🔒 Bloqueando ajustes: " + packageName);
                dispararBloqueoConDuracion(7000);
                return;
            }
            
            if (shieldMode && !packageName.contains("educontrolpro")) {
                Log.d("EDU_Monitor", "🔒 Blindaje activo, bloqueando: " + packageName);
                dispararBloqueoConDuracion(7000);
                return;
            }
            
            if ((cortarNavegacion || blockAllBrowsing) && esNavegador(packageName)) {
                Log.d("EDU_Monitor", "🔒 Navegador bloqueado por política");
                dispararBloqueoConDuracion(7000);
                return;
            }
            
            List<String> redes = Arrays.asList("tiktok", "instagram", "facebook", "youtube", "twitter", "whatsapp");
            for (String social : redes) {
                if (packageName.toLowerCase().contains(social)) {
                    Log.d("EDU_Monitor", "🔒 Red social detectada: " + packageName);
                    reportarIncidencia("RED_SOCIAL", "Intento de acceso a red social", packageName);
                    dispararBloqueoConDuracion(7000);
                    return;
                }
            }
            
            if (esNavegador(packageName)) {
                analizarContenido(event.getSource());
            }
        } catch (Exception e) {
            Log.e("EDU_Monitor", "❌ Error en onAccessibilityEvent", e);
            guardarErrorEnFirestore("onAccessibilityEvent", e);
        }
    }

    private boolean esNavegador(String pkg) {
        try {
            String p = pkg.toLowerCase();
            return p.contains("chrome") || p.contains("browser") || p.contains("firefox") || 
                   p.contains("opera") || p.contains("edge") || p.contains("brave") ||
                   (p.contains("samsung") && p.contains("browser"));
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error en esNavegador", e);
            guardarErrorEnFirestore("esNavegador", e);
            return false;
        }
    }

    private void analizarContenido(AccessibilityNodeInfo node) {
        try {
            if (node == null) return;
            
            if (node.getClassName() != null && node.getClassName().toString().contains("EditText")) {
                CharSequence texto = node.getText();
                if (texto != null) {
                    String url = texto.toString();
                    if (url.startsWith("http") || url.contains(".")) {
                        Log.d("EDU_Monitor", "🌐 URL detectada: " + url);
                        reportarUrlActual(url);
                        
                        if (useBlacklist && listaNegra != null && !listaNegra.isEmpty()) {
                            for (String sitio : listaNegra) {
                                if (url.toLowerCase().contains(sitio.toLowerCase())) {
                                    Log.d("EDU_Monitor", "🔒 Sitio en blacklist: " + sitio);
                                    reportarIncidencia("BLOQUEO_LISTA_NEGRA", "Intento de acceso a sitio bloqueado", url);
                                    dispararBloqueoConDuracion(7000);
                                    return;
                                }
                            }
                        }
                    }
                }
            }
            
            for (int i = 0; i < node.getChildCount(); i++) {
                analizarContenido(node.getChild(i));
            }
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error en analizarContenido", e);
            guardarErrorEnFirestore("analizarContenido", e);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d("EDU_Monitor", "💥 onDestroy: Servicio destruido");
        
        try {
            if (deviceListener != null) deviceListener.remove();
            if (institutionListener != null) institutionListener.remove();
            if (securityListener != null) securityListener.remove();
            
            if (heartbeatHandler != null && heartbeatRunnable != null) {
                heartbeatHandler.removeCallbacks(heartbeatRunnable);
            }
            
            if (closeLockReceiver != null) {
                try {
                    unregisterReceiver(closeLockReceiver);
                } catch (Exception e) {
                    Log.e("EDU_Monitor", "Error al desregistrar receiver", e);
                    guardarErrorEnFirestore("onDestroy/unregisterReceiver", e);
                }
            }
            
            if (deviceDocId != null) {
                Map<String, Object> offline = new HashMap<>();
                offline.put("online", false);
                offline.put("ultimoAcceso", FieldValue.serverTimestamp());
                db.collection("dispositivos").document(deviceDocId)
                    .update(offline)
                    .addOnFailureListener(e -> {
                        Log.e("EDU_Monitor", "Error reportando offline", e);
                        guardarErrorEnFirestore("onDestroy/offline", e);
                    });
            }
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error en onDestroy", e);
            guardarErrorEnFirestore("onDestroy", e);
        }
    }

    @Override
    public void onInterrupt() {
        Log.d("EDU_Monitor", "⚠️ onInterrupt: Servicio interrumpido");
    }
}