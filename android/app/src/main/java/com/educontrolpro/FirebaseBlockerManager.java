package com.educontrolpro;

import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.QueryDocumentSnapshot;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.MetadataChanges;

import java.util.HashSet;
import java.util.Set;

public class FirebaseBlockerManager {
    private static FirebaseBlockerManager instance;
    private FirebaseFirestore db;
    private Set<String> sitiosBloqueados;
    private ListenerRegistration registration;
    private OnBlockedSitesUpdatedListener listener;

    public interface OnBlockedSitesUpdatedListener {
        void onBlockedSitesUpdated(Set<String> sitios);
    }

    private FirebaseBlockerManager() {
        db = FirebaseFirestore.getInstance();
        sitiosBloqueados = new HashSet<>();
    }

    public static synchronized FirebaseBlockerManager getInstance() {
        if (instance == null) {
            instance = new FirebaseBlockerManager();
        }
        return instance;
    }

    public void startListening(OnBlockedSitesUpdatedListener listener) {
        this.listener = listener;
        
        // Escuchar cambios en tiempo real en la colección "sitiosBloqueados"
        registration = db.collection("sitiosBloqueados")
            .addSnapshotListener(MetadataChanges.INCLUDE, (value, error) -> {
                if (error != null) {
                    SimpleLogger.e("Firestore error: " + error.getMessage());
                    return;
                }

                if (value != null) {
                    sitiosBloqueados.clear();
                    for (QueryDocumentSnapshot doc : value) {
                        String url = doc.getString("url");
                        Boolean bloqueado = doc.getBoolean("bloqueado");
                        
                        // Si el documento tiene url y está bloqueado (o no especifica, asumimos que sí)
                        if (url != null && (bloqueado == null || bloqueado)) {
                            sitiosBloqueados.add(url.toLowerCase().trim());
                            SimpleLogger.d("Sitio bloqueado cargado: " + url);
                        }
                    }
                    
                    SimpleLogger.i("Total sitios bloqueados: " + sitiosBloqueados.size());
                    
                    // Notificar al listener (nuestro VPN service)
                    if (this.listener != null) {
                        this.listener.onBlockedSitesUpdated(new HashSet<>(sitiosBloqueados));
                    }
                }
            });
    }

    public void stopListening() {
        if (registration != null) {
            registration.remove();
            registration = null;
        }
    }

    public boolean estaBloqueado(String url) {
        if (url == null || url.isEmpty()) return false;
        
        String urlLower = url.toLowerCase();
        
        // Verificar si la URL contiene algún sitio bloqueado
        for (String sitio : sitiosBloqueados) {
            if (urlLower.contains(sitio)) {
                SimpleLogger.d("BLOQUEADO: " + url + " contiene " + sitio);
                return true;
            }
        }
        return false;
    }

    public Set<String> getSitiosBloqueados() {
        return new HashSet<>(sitiosBloqueados);
    }
}