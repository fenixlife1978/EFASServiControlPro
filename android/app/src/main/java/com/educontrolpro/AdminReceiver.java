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
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                dpm.setOrganizationName(adminComponent, "EDUControlPro - Gestión Institucional");
            }

            dpm.setUninstallBlocked(adminComponent, context.getPackageName(), true);
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET);
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_ADD_USER);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_SAFE_BOOT);
            }
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_DEBUGGING_FEATURES);
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_VPN);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                try {
                    dpm.setAlwaysOnVpnPackage(adminComponent, context.getPackageName(), true);
                } catch (Exception e) {
                    Log.e(TAG, "No se pudo establecer Always-On VPN (puede que no sea Device Owner)");
                }
            }

            Log.d(TAG, "Políticas de administrador aplicadas correctamente.");
        } catch (SecurityException e) {
            Log.e(TAG, "Error: Permisos insuficientes. La app debe ser administrador de dispositivo.");
        } catch (Exception e) {
            Log.e(TAG, "Error en configuración: " + e.getMessage());
        }

        Toast.makeText(context, "EDUControlPro: Protección de Dispositivo Activada", Toast.LENGTH_SHORT).show();
    }

    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        try {
            Intent lockIntent = new Intent(context, LockActivity.class);
            lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            context.startActivity(lockIntent);
        } catch (Exception e) {
            Log.e(TAG, "Error al mostrar pantalla de bloqueo: " + e.getMessage());
        }

        return "ADVERTENCIA: Si desactiva la protección, el dispositivo perderá acceso a la red institucional y será reportado.";
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        super.onDisabled(context, intent);
        Log.w(TAG, "Admin deshabilitado");
        Toast.makeText(context, "EDUControlPro: La protección ha sido desactivada", Toast.LENGTH_SHORT).show();
    }
}