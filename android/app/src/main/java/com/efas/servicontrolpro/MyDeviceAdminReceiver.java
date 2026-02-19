package com.efas.servicontrolpro;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.widget.Toast;
import androidx.annotation.NonNull;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.HashMap;
import java.util.Map;

public class MyDeviceAdminReceiver extends DeviceAdminReceiver {

    @Override
    public void onEnabled(@NonNull Context context, @NonNull Intent intent) {
        super.onEnabled(context, intent);
        updateProtectionStatus(context, "protegido");
        Toast.makeText(context, "EFAS Guardian: Protección del Sistema Activa", Toast.LENGTH_SHORT).show();
    }

    @Override
    public CharSequence onDisableRequested(@NonNull Context context, @NonNull Intent intent) {
        // Reportar intento de sabotaje antes de que ocurra
        updateProtectionStatus(context, "intento_desactivacion");
        return "ALERTA DE SEGURIDAD: Intentar desactivar EFAS ServiControlPro notificará inmediatamente a la administración.";
    }

    @Override
    public void onDisabled(@NonNull Context context, @NonNull Intent intent) {
        super.onDisabled(context, intent);
        updateProtectionStatus(context, "vulnerable");
        Toast.makeText(context, "ATENCIÓN: El dispositivo ya no está protegido por EFAS", Toast.LENGTH_LONG).show();
    }

    private void updateProtectionStatus(Context context, String status) {
        String deviceId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        
        Map<String, Object> update = new HashMap<>();
        update.put("protectionLevel", status);
        update.put("lastSecurityEvent", com.google.firebase.Timestamp.now());

        if (deviceId != null) {
            db.collection("dispositivos").document(deviceId)
                .update(update);
        }
    }
}
