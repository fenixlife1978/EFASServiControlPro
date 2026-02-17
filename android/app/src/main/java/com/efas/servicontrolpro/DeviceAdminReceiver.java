package com.efas.servicontrolpro;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;
import androidx.annotation.NonNull;

public class DeviceAdminReceiver extends android.app.admin.DeviceAdminReceiver {

    @Override
    public void onEnabled(@NonNull Context context, @NonNull Intent intent) {
        super.onEnabled(context, intent);
        Toast.makeText(context, "EFAS: Protección de Administrador Activada", Toast.LENGTH_LONG).show();
    }

    @Override
    public void onDisabled(@NonNull Context context, @NonNull Intent intent) {
        super.onDisabled(context, intent);
        Toast.makeText(context, "ALERTA: La protección ha sido desactivada", Toast.LENGTH_LONG).show();
    }

    @Override
    public CharSequence onDisableRequested(@NonNull Context context, @NonNull Intent intent) {
        // Este mensaje aparece cuando alguien intenta quitar el permiso de admin
        return "ADVERTENCIA DE SEGURIDAD: Se requiere la CLAVE MAESTRA de EFAS ServiControlPro para desvincular este dispositivo. Si continúa, se enviará una alerta inmediata a la central.";
    }
}
