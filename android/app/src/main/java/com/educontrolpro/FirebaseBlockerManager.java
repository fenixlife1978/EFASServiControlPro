package com.educontrolpro;

import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.MetadataChanges;
import com.google.firebase.firestore.FieldValue;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import android.content.SharedPreferences;
import android.content.Context;

public class FirebaseBlockerManager {
    private static FirebaseBlockerManager instance;
    private FirebaseFirestore db;
    private Set<String> sitiosBloqueados;
    private ListenerRegistration registration;
    private OnBlockedSitesUpdatedListener listener;
    private String currentInstitutionId = null;
    private String currentDeviceId = null;
    private boolean modoCortarNavegacion = false;
    private Context appContext; // NUEVO: Guardar contexto

    public interface OnBlockedSitesUpdatedListener {
        void onBlockedSitesUpdated(Set<String> sitios);
    }

    private FirebaseBlockerManager() {
        db = FirebaseFirestore.getInstance();
        sitiosBloqueados = new HashSet<>();
        SimpleLogger.i("🔥 FirebaseBlockerManager - Inicializado");
    }

    public static synchronized FirebaseBlockerManager getInstance() {
        if (instance == null) {
            instance = new FirebaseBlockerManager();
        }
        return instance;
    }

    // NUEVO: Método init que llama ParentalControlVpnService
    public void init(Context context) {
        this.appContext = context.getApplicationContext();
        obtenerIdsLocales();
    }

    private void obtenerIdsLocales() {
        try {
            if (appContext == null) {
                SimpleLogger.e("🔥 Error: appContext es null. Llama a init() primero");
                return;
            }
            
            SharedPreferences prefs = appContext.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            currentDeviceId = prefs.getString("deviceId", null);
            currentInstitutionId = prefs.getString("InstitutoId", null);
            
            // Log a Firebase
            logToFirebase("IDS_OBTENIDOS", "deviceId: " + currentDeviceId + ", institutionId: " + currentInstitutionId);
            
            SimpleLogger.i("🔥 IDs locales - deviceId: " + currentDeviceId + 
                          ", institutionId: " + currentInstitutionId);
        } catch (Exception e) {
            logToFirebase("ERROR_IDS", e.getMessage());
            SimpleLogger.e("🔥 Error obteniendo IDs: " + e.getMessage());
        }
    }

    // Método para enviar logs a Firestore
    private void logToFirebase(String tipo, String mensaje) {
        try {
            if (currentDeviceId == null) return;
            
            Map<String, Object> logEntry = new HashMap<>();
            logEntry.put("tipo", tipo);
            logEntry.put("mensaje", mensaje);
            logEntry.put("timestamp", FieldValue.serverTimestamp());
            logEntry.put("origen", "FirebaseBlockerManager");
            logEntry.put("sitiosCount", sitiosBloqueados != null ? sitiosBloqueados.size() : 0);
            
            db.collection("dispositivos")
                .document(currentDeviceId)
                .collection("vpn_logs")
                .add(logEntry);
        } catch (Exception e) {
            // Ignorar errores de log
        }
    }

    public void startListening(OnBlockedSitesUpdatedListener listener) {
        this.listener = listener;
        
        obtenerIdsLocales(); // Re-obtener por si acaso
        
        if (currentInstitutionId == null) {
            SimpleLogger.e("🔥 ERROR: No hay institutionId, el dispositivo no está vinculado");
            logToFirebase("ERROR_SIN_INSTITUCION", "No hay institutionId");
            return;
        }
        
        SimpleLogger.i("🔥 Escuchando cambios para institución: " + currentInstitutionId);
        logToFirebase("START_LISTENING", "Escuchando institución: " + currentInstitutionId);
        
        // Escuchar cambios en el documento de la institución
        registration = db.collection("institutions")
            .document(currentInstitutionId)
            .addSnapshotListener(MetadataChanges.INCLUDE, (documentSnapshot, error) -> {
                if (error != null) {
                    SimpleLogger.e("🔥 Error de Firestore: " + error.getMessage());
                    logToFirebase("FIRESTORE_ERROR", error.getMessage());
                    return;
                }

                if (documentSnapshot != null && documentSnapshot.exists()) {
                    sitiosBloqueados.clear();
                    logToFirebase("DOCUMENTO_RECIBIDO", "Documento de institución existe");
                    
                    // 1. Leer el campo blacklist de la institución (array)
                    Object blacklistObj = documentSnapshot.get("blacklist");
                    if (blacklistObj instanceof List) {
                        List<?> blacklist = (List<?>) blacklistObj;
                        SimpleLogger.i("🔥 blacklist de institución encontrada con " + blacklist.size() + " elementos");
                        logToFirebase("BLACKLIST_RECIBIDA", "Elementos: " + blacklist.size());
                        
                        for (Object item : blacklist) {
                            if (item instanceof String) {
                                String sitio = ((String) item).toLowerCase().trim();
                                // Limpiar URLs
                                sitio = sitio.replace("http://", "")
                                             .replace("https://", "")
                                             .replace("www.", "")
                                             .trim();
                                if (!sitio.isEmpty()) {
                                    sitiosBloqueados.add(sitio);
                                    SimpleLogger.d("🔥 Sitio bloqueado (institución): " + sitio);
                                }
                            }
                        }
                    } else {
                        SimpleLogger.w("🔥 No hay campo blacklist en la institución");
                        logToFirebase("BLACKLIST_NO_ENCONTRADA", "No hay campo blacklist");
                    }
                    
                    // 2. Verificar modo cortar navegación
                    Boolean cortarNavegacion = documentSnapshot.getBoolean("cortarNavegacion");
                    modoCortarNavegacion = (cortarNavegacion != null && cortarNavegacion);
                    
                    if (modoCortarNavegacion) {
                        SimpleLogger.w("🔥 ⚠️ MODO CORTAR NAVEGACIÓN ACTIVADO - TODO BLOQUEADO");
                        logToFirebase("MODO_CORTAR", "Cortar navegación activado");
                        sitiosBloqueados.add("*");
                    }
                    
                    // 3. Leer useBlacklist
                    Boolean useBlacklist = documentSnapshot.getBoolean("useBlacklist");
                    logToFirebase("USE_BLACKLIST", "Valor: " + useBlacklist);
                    
                    SimpleLogger.i("🔥 Total sitios bloqueados a aplicar: " + sitiosBloqueados.size());
                    logToFirebase("SITIOS_TOTAL", "Total: " + sitiosBloqueados.size());
                    
                    // Notificar al listener
                    if (this.listener != null) {
                        this.listener.onBlockedSitesUpdated(new HashSet<>(sitiosBloqueados));
                        logToFirebase("LISTENER_NOTIFICADO", "Listener notificado con " + sitiosBloqueados.size() + " sitios");
                    }
                } else {
                    SimpleLogger.w("🔥 Documento de institución no existe");
                    logToFirebase("DOCUMENTO_NO_EXISTE", "La institución " + currentInstitutionId + " no existe");
                }
            });
    }

    public void stopListening() {
        if (registration != null) {
            registration.remove();
            registration = null;
            logToFirebase("STOP_LISTENING", "Escucha detenida");
            SimpleLogger.i("🔥 FirebaseBlockerManager - Escucha detenida");
        }
    }

    public boolean estaBloqueado(String url) {
        if (url == null || url.isEmpty()) return false;
        
        if (sitiosBloqueados.isEmpty()) {
            return false;
        }
        
        if (modoCortarNavegacion || sitiosBloqueados.contains("*")) {
            SimpleLogger.d("🔥 CORTAR NAVEGACIÓN: Bloqueando todo");
            return true;
        }
        
        String urlLower = url.toLowerCase();
        for (String sitio : sitiosBloqueados) {
            if (urlLower.contains(sitio.toLowerCase())) {
                SimpleLogger.d("🔥 BLOQUEADO: " + url + " contiene " + sitio);
                return true;
            }
        }
        return false;
    }

    public Set<String> getSitiosBloqueados() {
        return new HashSet<>(sitiosBloqueados);
    }
}