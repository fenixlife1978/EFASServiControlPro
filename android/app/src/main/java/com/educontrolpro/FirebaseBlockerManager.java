package com.educontrolpro;

import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.ValueEventListener;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import android.content.SharedPreferences;
import android.content.Context;

public class FirebaseBlockerManager {
    private static FirebaseBlockerManager instance;
    
    // Realtime Database (para datos pesados/frecuentes)
    private FirebaseDatabase realtimeDb;
    private DatabaseReference instConfigRef;
    private DatabaseReference logsRef;
    
    // Firestore (para datos ligeros/respaldo)
    private FirebaseFirestore firestore;
    
    private Set<String> sitiosBloqueados;
    private OnBlockedSitesUpdatedListener listener;
    private String currentInstitutionId = null;
    private String currentDeviceId = null;
    private boolean modoCortarNavegacion = false;
    private Context appContext;
    
    // LISTENER DECLARADO - AÑADIDO
    private ValueEventListener configListener;

    public interface OnBlockedSitesUpdatedListener {
        void onBlockedSitesUpdated(Set<String> sitios);
    }

    private FirebaseBlockerManager() {
        // Realtime DB para operaciones pesadas
        realtimeDb = FirebaseDatabase.getInstance();
        
        // Firestore para respaldo y consultas complejas
        firestore = FirebaseFirestore.getInstance();
        
        sitiosBloqueados = new HashSet<>();
        SimpleLogger.i("🔥 FirebaseBlockerManager - Inicializado (Modo Híbrido)");
    }

    public static synchronized FirebaseBlockerManager getInstance() {
        if (instance == null) {
            instance = new FirebaseBlockerManager();
        }
        return instance;
    }

    public void init(Context context) {
        this.appContext = context.getApplicationContext();
        obtenerIdsLocales();
        
        if (currentDeviceId != null) {
            // Realtime para logs frecuentes
            logsRef = realtimeDb.getReference("dispositivos").child(currentDeviceId).child("vpn_logs");
        }
    }

    private void obtenerIdsLocales() {
        try {
            if (appContext == null) {
                SimpleLogger.e("🔥 Error: appContext es null");
                return;
            }
            
            SharedPreferences prefs = appContext.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            currentDeviceId = prefs.getString("deviceId", null);
            currentInstitutionId = prefs.getString("InstitutoId", null);
            
            // Log a Realtime (rápido)
            logToRealtime("IDS_OBTENIDOS", "deviceId: " + currentDeviceId + ", institutionId: " + currentInstitutionId);
            
            // Backup a Firestore (solo eventos importantes)
            if (currentDeviceId != null) {
                backupToFirestore("IDS_OBTENIDOS", currentDeviceId + " - " + currentInstitutionId);
            }
            
            SimpleLogger.i("🔥 IDs locales - deviceId: " + currentDeviceId + ", institutionId: " + currentInstitutionId);
        } catch (Exception e) {
            logToRealtime("ERROR_IDS", e.getMessage());
        }
    }

    // LOGS PESADOS -> REALTIME DB (miles de escrituras)
    private void logToRealtime(String tipo, String mensaje) {
        try {
            if (currentDeviceId == null || logsRef == null) return;
            
            Map<String, Object> logEntry = new HashMap<>();
            logEntry.put("tipo", tipo);
            logEntry.put("mensaje", mensaje);
            logEntry.put("timestamp", System.currentTimeMillis());
            logEntry.put("origen", "FirebaseBlockerManager");
            logEntry.put("sitiosCount", sitiosBloqueados != null ? sitiosBloqueados.size() : 0);
            
            // push() genera ID único, perfecto para logs
            logsRef.push().setValue(logEntry);
            
        } catch (Exception e) {
            SimpleLogger.e("Error en logToRealtime: " + e.getMessage());
        }
    }

    // BACKUP LIGERO -> FIRESTORE (solo datos importantes)
    private void backupToFirestore(String tipo, String descripcion) {
        try {
            if (currentDeviceId == null) return;
            
            Map<String, Object> backupEntry = new HashMap<>();
            backupEntry.put("tipo", tipo);
            backupEntry.put("descripcion", descripcion);
            backupEntry.put("timestamp", FieldValue.serverTimestamp());
            backupEntry.put("deviceId", currentDeviceId);
            
            firestore.collection("backup_eventos")
                .add(backupEntry);
                
        } catch (Exception e) {
            // Ignorar errores de backup
        }
    }

    public void startListening(OnBlockedSitesUpdatedListener listener) {
        this.listener = listener;
        
        obtenerIdsLocales();
        
        if (currentInstitutionId == null) {
            SimpleLogger.e("🔥 ERROR: No hay institutionId");
            logToRealtime("ERROR_SIN_INSTITUCION", "No hay institutionId");
            return;
        }
        
        SimpleLogger.i("🔥 Escuchando institución (Realtime): " + currentInstitutionId);
        logToRealtime("START_LISTENING", "Escuchando: " + currentInstitutionId);
        
        // CONFIGURACIÓN PESADA -> REALTIME DB
        String path = "instituciones/" + currentInstitutionId + "/config";
        instConfigRef = realtimeDb.getReference(path);
        
        configListener = new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                sitiosBloqueados.clear();
                
                // Leer blacklist de Realtime
                DataSnapshot blacklistSnap = snapshot.child("blacklist");
                if (blacklistSnap.exists()) {
                    for (DataSnapshot sitioSnap : blacklistSnap.getChildren()) {
                        String sitio = sitioSnap.getValue(String.class);
                        if (sitio != null) {
                            sitio = sitio.toLowerCase().trim()
                                        .replace("http://", "")
                                        .replace("https://", "")
                                        .replace("www.", "");
                            if (!sitio.isEmpty()) {
                                sitiosBloqueados.add(sitio);
                            }
                        }
                    }
                    logToRealtime("BLACKLIST", "Cargados: " + sitiosBloqueados.size());
                }
                
                // Modo cortar navegación
                Boolean cortarNavegacion = snapshot.child("cortarNavegacion").getValue(Boolean.class);
                modoCortarNavegacion = (cortarNavegacion != null && cortarNavegacion);
                
                if (modoCortarNavegacion) {
                    sitiosBloqueados.add("*");
                    logToRealtime("MODO_CORTAR", "Activado");
                }
                
                // Notificar
                if (listener != null) {
                    listener.onBlockedSitesUpdated(new HashSet<>(sitiosBloqueados));
                }
                
                // Backup LIGERO a Firestore (solo cuando cambia)
                backupToFirestore("CONFIG_UPDATE", "Sitios: " + sitiosBloqueados.size());
            }

            @Override
            public void onCancelled(DatabaseError error) {
                SimpleLogger.e("🔥 Error Realtime: " + error.getMessage());
                logToRealtime("REALTIME_ERROR", error.getMessage());
            }
        };
        
        instConfigRef.addValueEventListener(configListener);
    }

    public void stopListening() {
        if (configListener != null && instConfigRef != null) {
            instConfigRef.removeEventListener(configListener);
            configListener = null;
            logToRealtime("STOP_LISTENING", "Escucha detenida");
        }
    }

    public boolean estaBloqueado(String url) {
        if (url == null || url.isEmpty()) return false;
        if (sitiosBloqueados.isEmpty()) return false;
        
        if (modoCortarNavegacion || sitiosBloqueados.contains("*")) {
            return true;
        }
        
        String urlLower = url.toLowerCase();
        for (String sitio : sitiosBloqueados) {
            if (urlLower.contains(sitio.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    public Set<String> getSitiosBloqueados() {
        return new HashSet<>(sitiosBloqueados);
    }
}