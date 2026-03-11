package com.educontrolpro;

import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.UserManager;
import android.util.Log;
import android.widget.Toast;

public class AdminReceiver extends DeviceAdminReceiver {
    
    @Override
    public void onEnabled(Context context, Intent intent) {
        super.onEnabled(context, intent);
        Log.d("EDU_Admin", "Admin habilitado");
        
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(context, AdminReceiver.class);

        // --- BLOQUEOS DE SEGURIDAD (Requiere Device Owner vía ADB) ---
        try {
            // Bloquea la desinstalación de EDUControlPro
            dpm.setUninstallBlocked(adminComponent, context.getPackageName(), true);
            
            // Impide que el alumno cree otros usuarios o perfiles
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_ADD_USER);
            
            // Impide el restablecimiento de fábrica (Factory Reset)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET);
            
            // Impide configurar VPNs manualmente (mantiene la tuya siempre activa)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_VPN);

            Log.d("EDU_Admin", "Restricciones de Device Owner aplicadas con éxito.");
        } catch (SecurityException e) {
            Log.e("EDU_Admin", "Error: La app no es Device Owner todavía.");
        }
        
        Toast.makeText(context, "EDUControlPro: Protección de Dispositivo Activada", Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        super.onDisabled(context, intent);
        Log.w("EDU_Admin", "Admin deshabilitado por el usuario");
        Toast.makeText(context, "EDUControlPro: La protección ha sido desactivada", Toast.LENGTH_SHORT).show();
    }
    
    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        // Este mensaje aparece cuando intentan quitar el Admin desde Ajustes
        return "Si desactiva la protección, el dispositivo perderá acceso a las funciones educativas y será reportado.";
    }
}