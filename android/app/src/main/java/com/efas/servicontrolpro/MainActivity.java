package com.efas.servicontrolpro;

import android.os.Bundle;
import android.provider.Settings;
import android.content.Intent;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginCall;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.HashMap;
import java.util.Map;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    
    // Identificador único de la tablet
    private String deviceId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        deviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);

        // Iniciar el servicio de monitoreo de fondo
        startService(new Intent(this, MonitoringService.class));

        // Registro inicial si no existe
        initializeDeviceInFirebase();
    }

    private void initializeDeviceInFirebase() {
        FirebaseFirestore db = FirebaseFirestore.getInstance();

        db.collection("dispositivos").document(deviceId).get().addOnCompleteListener(task -> {
            if (task.isSuccessful() && !task.getResult().exists()) {
                Map<String, Object> deviceData = new HashMap<>();
                deviceData.put("id", deviceId);
                deviceData.put("status", "active");
                deviceData.put("alumno_asignado", "Esperando Vinculación");
                
                Map<String, Object> restrictions = new HashMap<>();
                restrictions.put("youtubeBlocked", false);
                restrictions.put("blockedAppList", new ArrayList<String>());
                
                deviceData.put("restrictions", restrictions);
                deviceData.put("createdAt", com.google.firebase.Timestamp.now());

                db.collection("dispositivos").document(deviceId).set(deviceData);
            }
        });
    }

    // --- NUEVO MÉTODO PARA VINCULAR DESDE EL QR ---
    // Este método lo llamará tu frontend de Capacitor al escanear el QR
    public void linkDeviceToInstitution(String institutoId, String alumnoId, String nombreAlumno) {
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        Map<String, Object> updates = new HashMap<>();
        
        updates.put("institutoId", institutoId);
        updates.put("alumno_id", alumnoId);
        updates.put("alumno_asignado", nombreAlumno);
        updates.put("lastUpdated", com.google.firebase.Timestamp.now());

        db.collection("dispositivos").document(deviceId)
            .update(updates)
            .addOnSuccessListener(aVoid -> Toast.makeText(this, "Dispositivo vinculado exitosamente", Toast.LENGTH_SHORT).show())
            .addOnFailureListener(e -> Toast.makeText(this, "Error en vinculación: " + e.getMessage(), Toast.LENGTH_LONG).show());
    }
}
