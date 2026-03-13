package com.educontrolpro;

import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.UserManager;
import android.widget.Toast;

import androidx.annotation.NonNull;

public class AdminReceiver extends DeviceAdminReceiver {

    @Override
    public void onEnabled(@NonNull Context context, @NonNull Intent intent) {
        super.onEnabled(context, intent);
        SimpleLogger.i("Admin habilitado. Aplicando políticas de blindaje...");

        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(context, AdminReceiver.class);

        try {
            // 1. IDENTIDAD INSTITUCIONAL
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                dpm.setOrganizationName(adminComponent, "EduControlPro - Gestión Institucional");
            }

            // 2. RESTRICCIONES DE DEVICE OWNER (Vía ADB)
            if (dpm.isDeviceOwnerApp(context.getPackageName())) {
                
                // --- BLOQUEO DE CONFIGURACIÓN ---
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    // Suspendemos ajustes para que no puedan manipular la red o apps
                    String[] packagesToSuspend = {"com.android.settings"};
                    dpm.setPackagesSuspended(adminComponent, packagesToSuspend, true);
                }

                // Blindaje contra desinstalación y factory reset
                dpm.setUninstallBlocked(adminComponent, context.getPackageName(), true);
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET);
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_ADD_USER);
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA); // Evita OTG/SD con scripts
                
                // Evitar el Modo Seguro (Safe Boot) - Crucial para que no desactiven el MonitorService
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_SAFE_BOOT);
                }
                
                // Bloqueo de depuración USB
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_DEBUGGING_FEATURES);
                
                // CONTROL TOTAL DE VPN
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_VPN);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    // Forzamos que nuestra VPN esté siempre activa y no se pueda saltar
                    try {
                        dpm.setAlwaysOnVpnPackage(adminComponent, context.getPackageName(), true);
                    } catch (Exception e) {
                        SimpleLogger.e("Error en Always-On VPN: " + e.getMessage());
                    }
                }
                
                SimpleLogger.i("Políticas de Device Owner aplicadas.");
            } else {
                SimpleLogger.w("La app no es Device Owner. Aplicando políticas básicas.");
                // Políticas básicas si solo es Device Admin
                dpm.setPasswordQuality(adminComponent, DevicePolicyManager.PASSWORD_QUALITY_SOMETHING);
            }

        } catch (Exception e) {
            SimpleLogger.e("Error en AdminReceiver: " + e.getMessage());
        }

        Toast.makeText(context, "Protección Institucional Activa", Toast.LENGTH_SHORT).show();
    }

    @Override
    public CharSequence onDisableRequested(@NonNull Context context, @NonNull Intent intent) {
        // Interceptamos el intento de desactivar el Admin
        // Esto lanzará nuestra LockActivity inmediatamente
        Intent lockIntent = new Intent(context, LockActivity.class);
        lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        lockIntent.putExtra("tipo_bloqueo", "ADMIN_DISABLE_ATTEMPT");
        context.startActivity(lockIntent);

        return "ALERTA: Esta acción desactiva la protección escolar. El intento será reportado al panel administrativo.";
    }

    @Override
    public void onDisabled(@NonNull Context context, @NonNull Intent intent) {
        super.onDisabled(context, intent);
        SimpleLogger.w("Protección desactivada.");
    }
}