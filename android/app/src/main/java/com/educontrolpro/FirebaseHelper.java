package com.educontrolpro;

import android.util.Log;
import com.google.firebase.firestore.CollectionReference;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.QueryDocumentSnapshot;
import java.util.HashSet;
import java.util.Set;

public class FirebaseHelper {

    private static final String TAG = "FirebaseHelper";
    private static final String COLLECTION_NAME = "blacklisted_domains";
    private static final String REPORTS_COLLECTION = "blocked_attempts";
    
    private ParentalControlVpnService vpnService;
    private FirebaseFirestore db;
    private ListenerRegistration blacklistListener;

    // Interfaz para comunicar cambios al servicio
    public interface ConfigListener {
        void onBlacklistUpdated(Set<String> newBlacklist);
    }

    public FirebaseHelper(ParentalControlVpnService service) {
        this.vpnService = service;
        this.db = FirebaseFirestore.getInstance();
    }

    /**
     * Escucha cambios en la colección de dominios bloqueados en tiempo real.
     * Si se agrega o quita un dominio en Firestore, la VPN se actualiza sola.
     */
    public void listenForConfigChanges(ConfigListener listener) {
        // Limpiar listener previo si existe
        if (blacklistListener != null) {
            blacklistListener.remove();
        }

        blacklistListener = db.collection(COLLECTION_NAME)
                .addSnapshotListener((value, error) -> {
                    if (error != null) {
                        SimpleLogger.e("Error escuchando cambios en Firebase: " + error.getMessage());
                        return;
                    }

                    if (value != null) {
                        Set<String> domains = new HashSet<>();
                        for (QueryDocumentSnapshot document : value) {
                            String domain = document.getString("domain");
                            if (domain != null) {
                                domains.add(domain.toLowerCase().trim());
                            }
                        }
                        
                        SimpleLogger.i("Firebase: Lista actualizada. Dominios: " + domains.size());
                        listener.onBlacklistUpdated(domains);
                    }
                });
    }

    /**
     * Reporta un intento de acceso a un sitio prohibido a Firestore.
     */
    public void reportBlockAttempt(String domain) {
        CollectionReference reportsRef = db.collection(REPORTS_COLLECTION);
        
        // Creamos un objeto de reporte con más contexto
        BlockReport report = new BlockReport(domain, System.currentTimeMillis());
        
        reportsRef.add(report)
                .addOnSuccessListener(documentReference -> {
                    Log.d(TAG, "Reporte enviado a la nube: " + domain);
                })
                .addOnFailureListener(e -> {
                    SimpleLogger.e("Error al reportar bloqueo en la nube: " + e.getMessage());
                });
    }

    /**
     * Desconecta los listeners de Firebase para evitar fugas de memoria.
     */
    public void cleanup() {
        if (blacklistListener != null) {
            blacklistListener.remove();
        }
    }

    // Clase interna para el mapeo de datos a Firestore
    public static class BlockReport {
        public String domain;
        public long timestamp;
        public String dateString;
        public String deviceModel;
        public String app = "EDUControlPro";

        public BlockReport(String domain, long timestamp) {
            this.domain = domain;
            this.timestamp = timestamp;
            // Guardamos la fecha legible para facilitar la lectura en el panel web/móvil
            this.dateString = new java.util.Date(timestamp).toString();
            this.deviceModel = android.os.Build.MODEL;
        }
    }
}