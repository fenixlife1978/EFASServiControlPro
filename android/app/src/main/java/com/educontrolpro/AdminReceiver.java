package com.educontrolpro;

import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import android.widget.Toast;

public class AdminReceiver extends DeviceAdminReceiver {
    
    @Override
    public void onEnabled(Context context, Intent intent) {
        super.onEnabled(context, intent);
        Log.d("EDU_Admin", "Admin habilitado");
        
        // Al activarse, aseguramos que el sistema reconozca las políticas
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(context, AdminReceiver.class);
        
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
        // Este mensaje aparece cuando alguien intenta desactivar el Admin desde ajustes
        return "Si desactiva la protección, el dispositivo perderá acceso a las funciones de EDUControlPro.";
    }
}