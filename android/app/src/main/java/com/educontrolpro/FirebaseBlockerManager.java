package com.educontrolpro;

import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.MetadataChanges;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.core.content.ContextCompat;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class FirebaseBlockerManager {
    private static FirebaseBlockerManager instance;
    private FirebaseFirestore db;
    private Set<String> sitiosBloqueados;
    private ListenerRegistration registration;
    private OnBlockedSitesUpdatedListener listener;
    private String currentInstitutionId = null;
    private String currentDeviceId = null;
    private boolean modoCortarNavegacion = false;

    public interface OnBlockedSitesUpdatedListener {
        void onBlockedSitesUpdated(Set<String> sitios);
    }

    private FirebaseBlockerManager() {
        db = FirebaseFirestore.getInstance();
        sitiosBloqueados = new HashSet<>();
        SimpleLogger.i("🔥 FirebaseBlockerManager - Inicializado");
        
        // Obtener IDs al iniciar
        obtenerIdsLocales();
    }

    public static synchronized FirebaseBlockerManager getInstance() {
        if (instance == null) {
            instance = new FirebaseBlockerManager();
        }
        return instance;
    }

    private void obtenerIdsLocales() {
        try {
            // Usamos el contexto de la aplicación directamente (necesitamos una referencia al contexto)
            // Esto se puede mejorar pasando el contexto desde el servicio, pero para SharedPreferences podemos usar el contexto por defecto.
            // Como no tenemos contexto aquí, lo mejor es recibirlo como parámetro en startListening.
            // Por ahora, lo dejamos así y lo arreglamos en el próximo paso.
            // Para no complicar, modificamos el método para recibir el contexto.
            // Pero como es un singleton, necesitamos que el servicio pase el contexto.
            // Lo cambiaremos en startListening.
            SimpleLogger.w("🔥 obtenerIdsLocales sin contexto, se obtendrán en startListening");
        } catch (Exception e) {
            SimpleLogger.e("🔥 Error obteniendo IDs: " + e.getMessage());
        }
    }

    public void startListening(Context context, OnBlockedSitesUpdatedListener listener) {
        this.listener = listener;
        
        // Obtener IDs desde SharedPreferences usando el contexto proporcionado
        if (context != null) {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            currentDeviceId = prefs.getString("deviceId", null);
            currentInstitutionId = prefs.getString("InstitutoId", null);
            SimpleLogger.i("🔥 IDs locales - deviceId: " + currentDeviceId + ", institutionId: " + currentInstitutionId);
        }
        
        if (currentInstitutionId == null) {
            SimpleLogger.e("🔥 ERROR: No hay institutionId, el dispositivo no está vinculado");
            return;
        }
        
        SimpleLogger.i("🔥 Escuchando cambios para institución: " + currentInstitutionId);
        
        // Escuchar cambios en el documento de la institución
        registration = db.collection("institutions")
            .document(currentInstitutionId)
            .addSnapshotListener(MetadataChanges.INCLUDE, (documentSnapshot, error) -> {
                if (error != null) {
                    SimpleLogger.e("🔥 Error de Firestore: " + error.getMessage());
                    return;
                }

                if (documentSnapshot != null && documentSnapshot.exists()) {
                    sitiosBloqueados.clear();
                    
                    // Leer el campo blacklist (array)
                    Object blacklistObj = documentSnapshot.get("blacklist");
                    if (blacklistObj instanceof List) {
                        List<?> blacklist = (List<?>) blacklistObj;
                        SimpleLogger.i("🔥 blacklist encontrada con " + blacklist.size() + " elementos");
                        
                        for (Object item : blacklist) {
                            if (item instanceof String) {
                                String sitio = ((String) item).toLowerCase().trim();
                                // Limpiar URLs (quitar http://, https://, www.)
                                sitio = sitio.replace("http://", "")
                                             .replace("https://", "")
                                             .replace("www.", "")
                                             .trim();
                                if (!sitio.isEmpty()) {
                                    sitiosBloqueados.add(sitio);
                                    SimpleLogger.d("🔥 Sitio bloqueado: " + sitio);
                                }
                            }
                        }
                    } else {
                        SimpleLogger.w("🔥 No hay campo blacklist o no es un array");
                    }
                    
                    // Verificar modo cortar navegación
                    Boolean cortarNavegacion = documentSnapshot.getBoolean("cortarNavegacion");
                    modoCortarNavegacion = (cortarNavegacion != null && cortarNavegacion);
                    
                    if (modoCortarNavegacion) {
                        SimpleLogger.w("🔥 ⚠️ MODO CORTAR NAVEGACIÓN ACTIVADO - TODO BLOQUEADO");
                        sitiosBloqueados.add("*");
                    }
                    
                    // Verificar useBlacklist
                    Boolean useBlacklist = documentSnapshot.getBoolean("useBlacklist");
                    if (useBlacklist == null || !useBlacklist) {
                        SimpleLogger.i("🔥 useBlacklist=false, no se aplicará bloqueo");
                        sitiosBloqueados.clear();
                    }
                    
                    SimpleLogger.i("🔥 Total sitios bloqueados a aplicar: " + sitiosBloqueados.size());
                    
                    // Notificar al listener
                    if (this.listener != null) {
                        this.listener.onBlockedSitesUpdated(new HashSet<>(sitiosBloqueados));
                    }
                } else {
                    SimpleLogger.w("🔥 Documento de institución no existe");
                }
            });
    }

    // Versión anterior para compatibilidad (sin contexto) - la dejamos pero la marcamos deprecated
    @Deprecated
    public void startListening(OnBlockedSitesUpdatedListener listener) {
        startListening(null, listener);
    }

    public void stopListening() {
        if (registration != null) {
            registration.remove();
            registration = null;
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