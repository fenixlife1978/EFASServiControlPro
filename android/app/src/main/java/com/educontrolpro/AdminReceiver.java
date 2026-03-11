package com.educontrolpro;

import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.UserManager;
import android.util.Log;
import android.widget.Toast;

public class AdminReceiver extends DeviceAdminReceiver {

    private static final String TAG = "EDU_Admin";

    @Override
    public void onEnabled(Context context, Intent intent) {
        super.onEnabled(context, intent);
        Log.d(TAG, "Admin habilitado");

        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(context, AdminReceiver.class);

        try {
            // --- IDENTIDAD INSTITUCIONAL (Resuelve el "ruido" de notificaciones) ---
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                dpm.setOrganizationName(adminComponent, "EDUControlPro - Gestión Institucional");
            }

            // --- RESTRICCIONES DE DEVICE OWNER (Blindaje V10.3) ---
            
            // 1. Bloqueo de Desinstalación
            dpm.setUninstallBlocked(adminComponent, context.getPackageName(), true);
            
            // 2. Bloqueo de Restablecimiento y Usuarios
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET);
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_ADD_USER);
            
            // 3. Bloqueo de Modos de Evasión (Modo Seguro y Debug USB)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_SAFE_BOOT);
            }
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_DEBUGGING_FEATURES);
            
            // 4. Control de Red y VPN (Mantiene el túnel siempre activo)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_VPN);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                dpm.setAlwaysOnVpnPackage(adminComponent, context.getPackageName(), true);
            }

            Log.d(TAG, "Políticas de Device Owner aplicadas correctamente.");
        } catch (SecurityException e) {
            Log.e(TAG, "Error: Permisos insuficientes. La app debe ser Device Owner.");
        } catch (Exception e) {
            Log.e(TAG, "Error en configuración: " + e.getMessage());
        }

        Toast.makeText(context, "EDUControlPro: Protección de Dispositivo Activada", Toast.LENGTH_SHORT).show();
    }

    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        // Interrupción proactiva: Si intentan entrar a desactivarlo, disparamos el bloqueo
        Intent lockIntent = new Intent(context, LockActivity.class);
        lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        context.startActivity(lockIntent);

        return "ADVERTENCIA: Si desactiva la protección, el dispositivo perderá acceso a la red institucional y será reportado.";
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        super.onDisabled(context, intent);
        Log.w(TAG, "Admin deshabilitado");
        Toast.makeText(context, "EDUControlPro: La protección ha sido desactivada", Toast.LENGTH_SHORT).show();
 
    }
}