package com.educontrolpro;

import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import android.widget.Toast;

import androidx.annotation.NonNull;

public class AdminReceiver extends DeviceAdminReceiver {

    private static final String TAG = "EDU_Admin";

    @Override
    public void onEnabled(@NonNull Context context, @NonNull Intent intent) {
        super.onEnabled(context, intent);
        Log.d(TAG, "Admin habilitado: EduControlPro tiene privilegios.");
        
        // Aquí podrías forzar políticas iniciales si fuera necesario
        Toast.makeText(context, "EduControlPro: Protección de Dispositivo Activada", Toast.LENGTH_LONG).show();
    }

    @Override
    public void onDisabled(@NonNull Context context, @NonNull Intent intent) {
        super.onDisabled(context, intent);
        Log.w(TAG, "ATENCIÓN: Admin deshabilitado por el usuario.");
        Toast.makeText(context, "Alerta: La protección del dispositivo ha sido desactivada.", Toast.LENGTH_LONG).show();
    }

    @Override
    public CharSequence onDisableRequested(@NonNull Context context, @NonNull Intent intent) {
        // Al intentar desactivar, bloqueamos la pantalla para prevenir acceso no autorizado inmediato
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        if (dpm != null) {
            dpm.lockNow(); // Bloquea el dispositivo al momento de solicitar la baja del admin
        }
        
        return "ADVERTENCIA: Si desactiva la protección, el dispositivo perderá acceso a las funciones de EduControlPro y se notificará al administrador.";
    }

    @Override
    public void onPasswordFailed(@NonNull Context context, @NonNull Intent intent) {
        super.onPasswordFailed(context, intent);
        Log.e(TAG, "Intento de contraseña fallido detectado.");
        // Aquí podrías enviar un evento a Firebase para alertar al Dashboard
    }

    @Override
    public void onPasswordSucceeded(@NonNull Context context, @NonNull Intent intent) {
        super.onPasswordSucceeded(context, intent);
        Log.d(TAG, "Acceso concedido al dispositivo.");
    }
}
