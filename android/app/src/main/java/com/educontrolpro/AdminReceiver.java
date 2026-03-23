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
        Log.d(TAG, "Admin habilitado: EduControlPro tiene privilegios de administrador.");
        
        // Aplicar políticas iniciales si es necesario
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(context, AdminReceiver.class);
        
        if (dpm != null && dpm.isAdminActive(admin)) {
            // Bloquear desinstalación de nuestra app
            try {
                dpm.setUninstallBlocked(admin, context.getPackageName(), true);
                Log.d(TAG, "Desinstalación bloqueada para EduControlPro");
            } catch (SecurityException e) {
                Log.e(TAG, "No se pudo bloquear desinstalación", e);
            }
        }
        
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
        // Al intentar desactivar, bloqueamos la pantalla para prevenir acceso no autorizado
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        if (dpm != null) {
            try {
                dpm.lockNow(); // Bloquea el dispositivo inmediatamente
                Log.d(TAG, "Dispositivo bloqueado al solicitar desactivación de admin");
            } catch (SecurityException e) {
                Log.e(TAG, "Error al bloquear dispositivo", e);
            }
        }
        
        return "ADVERTENCIA: Si desactiva la protección, el dispositivo perderá acceso a las funciones de EduControlPro y se notificará al administrador.";
    }

    @Override
    public void onPasswordFailed(@NonNull Context context, @NonNull Intent intent) {
        super.onPasswordFailed(context, intent);
        Log.e(TAG, "Intento de contraseña fallido detectado.");
        // Aquí se podría enviar un evento a Firebase para alertar al dashboard
        sendSecurityAlert(context, "Intento de contraseña fallido");
    }

    @Override
    public void onPasswordSucceeded(@NonNull Context context, @NonNull Intent intent) {
        super.onPasswordSucceeded(context, intent);
        Log.d(TAG, "Acceso concedido al dispositivo.");
    }
    
    @Override
    public void onLockTaskModeEntering(@NonNull Context context, @NonNull Intent intent, @NonNull String pkg) {
        super.onLockTaskModeEntering(context, intent, pkg);
        Log.d(TAG, "Modo kiosco activado para: " + pkg);
    }
    
    @Override
    public void onLockTaskModeExiting(@NonNull Context context, @NonNull Intent intent) {
        super.onLockTaskModeExiting(context, intent);
        Log.d(TAG, "Modo kiosco desactivado");
    }
    
    /**
     * Envía alerta de seguridad a Firestore
     */
    private void sendSecurityAlert(Context context, String message) {
        try {
            // Opcional: enviar a Firebase para alertas en tiempo real
            // Se puede implementar si se necesita
            Log.d(TAG, "Alerta de seguridad: " + message);
        } catch (Exception e) {
            Log.e(TAG, "Error enviando alerta", e);
        }
    }
}