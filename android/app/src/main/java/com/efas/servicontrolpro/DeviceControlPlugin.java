package com.efas.servicontrolpro;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.UserManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceControl")
public class DeviceControlPlugin extends Plugin {

    // Método para bloquear la pantalla (ya lo tenías)
    @PluginMethod
    public void lockDevice(PluginCall call) {
        Context context = getContext();
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminName = new ComponentName(context, MyDeviceAdminReceiver.class);

        if (dpm.isAdminActive(adminName)) {
            dpm.lockNow();
            call.resolve();
        } else {
            call.reject("Sin permisos de administrador");
        }
    }

    // NUEVO: Bloquear o Desbloquear una App (Ej: YouTube)
    // El panel enviará el paquete (com.google.android.youtube) y un booleano
    @PluginMethod
    public void setAppVisibility(PluginCall call) {
        String packageName = call.getString("packageName");
        Boolean hidden = call.getBoolean("hidden", true);
        
        Context context = getContext();
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminName = new ComponentName(context, MyDeviceAdminReceiver.class);

        try {
            // Esto oculta la app del sistema como si no existiera
            dpm.setApplicationHidden(adminName, packageName, hidden);
            call.resolve();
        } catch (Exception e) {
            call.reject("Error al cambiar visibilidad de app: " + e.getMessage());
        }
    }

    // NUEVO: Evitar que el alumno desinstale la app EFAS
    @PluginMethod
    public void setUninstallProtected(PluginCall call) {
        Boolean protectedMode = call.getBoolean("protected", true);
        Context context = getContext();
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminName = new ComponentName(context, MyDeviceAdminReceiver.class);

        try {
            dpm.setUninstallBlocked(adminName, context.getPackageName(), protectedMode);
            call.resolve();
        } catch (Exception e) {
            call.reject("Error al proteger desinstalación: " + e.getMessage());
        }
    }

    // NUEVO: Restringir funciones del sistema (No reset de fábrica, no modificar WiFi, etc.)
    @PluginMethod
    public void setSystemRestrictions(PluginCall call) {
        Context context = getContext();
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminName = new ComponentName(context, MyDeviceAdminReceiver.class);

        try {
            // Bloquea reset de fábrica
            dpm.addUserRestriction(adminName, UserManager.DISALLOW_FACTORY_RESET);
            // Bloquea añadir nuevas cuentas (Google, etc)
            dpm.addUserRestriction(adminName, UserManager.DISALLOW_ADD_USER);
            call.resolve();
        } catch (Exception e) {
            call.reject("Error en restricciones: " + e.getMessage());
        }
    }
}