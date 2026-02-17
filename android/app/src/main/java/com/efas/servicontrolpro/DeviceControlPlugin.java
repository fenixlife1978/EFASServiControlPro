package com.efas.servicontrolpro;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceControl")
public class DeviceControlPlugin extends Plugin {

    @PluginMethod
    public void lockDevice(PluginCall call) {
        Context context = getContext();
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminName = new ComponentName(context, MyDeviceAdminReceiver.class);

        if (dpm.isAdminActive(adminName)) {
            try {
                dpm.lockNow();
                call.resolve();
            } catch (Exception e) {
                call.reject("Error al bloquear: " + e.getMessage());
            }
        } else {
            call.reject("Error: La app no tiene permisos de Administrador de Dispositivo.");
        }
    }
}
