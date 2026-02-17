package com.efas.servicontrolpro;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;
import androidx.annotation.NonNull;

// Importamos lo necesario para una alerta básica (puedes expandir esto luego con Firebase SDK)
public class MyDeviceAdminReceiver extends DeviceAdminReceiver {

    @Override
    public void onEnabled(@NonNull Context context, @NonNull Intent intent) {
        super.onEnabled(context, intent);
        Toast.makeText(context, "EFAS: Administrador Activado", Toast.LENGTH_SHORT).show();
    }

    @Override
    public CharSequence onDisableRequested(@NonNull Context context, @NonNull Intent intent) {
        // AQUÍ DISPARAMOS LA ALERTA
        // En una implementación completa, aquí llamarías a un servicio para escribir en Firestore
        // Por ahora, bloqueamos la acción con un mensaje disuasorio profesional.
        return "ALERTA DE SEGURIDAD: Este intento ha sido reportado al Director de la Institución. El dispositivo se bloqueará permanentemente si continúa.";
    }

    @Override
    public void onDisabled(@NonNull Context context, @NonNull Intent intent) {
        super.onDisabled(context, intent);
        Toast.makeText(context, "ADVERTENCIA: Protección EFAS desactivada", Toast.LENGTH_LONG).show();
    }
}
