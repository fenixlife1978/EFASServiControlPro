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
                        domains.add(domain);
                    }
                }
                Log.d(TAG, "Sincronización exitosa. Dominios obtenidos: " + domains.size());
                if (vpnService != null) {
                    vpnService.updateBlacklist(domains);
                }
            } else {
                Log.e(TAG, "Error al obtener la lista negra", task.getException());
            }
        });
    }

    public void reportBlockAttempt(String domain) {
        CollectionReference reportsRef = db.collection("blocked_attempts");
        BlockReport report = new BlockReport(domain, System.currentTimeMillis());
        reportsRef.add(report)
                .addOnSuccessListener(aVoid -> Log.d(TAG, "Intento reportado con éxito: " + domain))
                .addOnFailureListener(e -> Log.e(TAG, "Error al reportar intento", e));
    }

    static class BlockReport {
        public String domain;
        public long timestamp;

        public BlockReport(String domain, long timestamp) {
            this.domain = domain;
            this.timestamp = timestamp;
        }
    }
}