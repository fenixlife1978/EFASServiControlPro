package com.educontrolpro;

import android.util.Log;
import com.google.firebase.firestore.CollectionReference;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.QueryDocumentSnapshot;
import java.util.HashSet;
import java.util.Set;

public class FirebaseHelper {

    private static final String TAG = "FirebaseHelper";
    private static final String COLLECTION_NAME = "blacklisted_domains";
    private ParentalControlVpnService vpnService;
    private FirebaseFirestore db;

    public FirebaseHelper(ParentalControlVpnService service) {
        this.vpnService = service;
        this.db = FirebaseFirestore.getInstance();
    }

    public void syncBlacklist() {
        CollectionReference blacklistRef = db.collection(COLLECTION_NAME);
        blacklistRef.get().addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                Set<String> domains = new HashSet<>();
                for (QueryDocumentSnapshot document : task.getResult()) {
                    String domain = document.getString("domain");
                    if (domain != null) {
                        domains.add(domain.toLowerCase().trim());
                    }
                }
                
                SimpleLogger.i("Sincronización exitosa. Dominios en la nube: " + domains.size());
                
                if (vpnService != null) {
                    // Llamamos al método en el servicio para actualizar la lista en memoria
                    vpnService.updateBlacklist(domains);
                }
            } else {
                SimpleLogger.e("Error al obtener la lista negra: " + task.getException());
            }
        });
    }

    public void reportBlockAttempt(String domain) {
        CollectionReference reportsRef = db.collection("blocked_attempts");
        BlockReport report = new BlockReport(domain, System.currentTimeMillis());
        
        reportsRef.add(report)
                .addOnSuccessListener(documentReference -> {
                    Log.d(TAG, "Intento reportado en Firestore: " + domain);
                })
                .addOnFailureListener(e -> {
                    SimpleLogger.e("Error al reportar bloqueo de " + domain + ": " + e.getMessage());
                });
    }

    // Clase para el reporte de intentos
    static class BlockReport {
        public String domain;
        public long timestamp;
        public String app = "EDUControlPro";

        public BlockReport(String domain, long timestamp) {
            this.domain = domain;
            this.timestamp = timestamp;
        }
    }
}