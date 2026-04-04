package com.educontrolpro;

import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import java.util.HashMap;
import java.util.Map;

public class AdminReceiver extends DeviceAdminReceiver {

    private static final String TAG = "AdminReceiver";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_ADMIN_ACTIVATED = "admin_activated";
    private static final String KEY_TECH_MODE = "tech_mode";
    private static final String KEY_BLOCK_MODE = "block_mode";
    private static final String KEY_INSTITUTO_ID = "InstitutoId";

    @Override
    public void onEnabled(@NonNull Context context, @NonNull Intent intent) {
        super.onEnabled(context, intent);
        Log.d(TAG, "🔒 Administrador de dispositivo HABILITADO");
        
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_ADMIN_ACTIVATED, true).apply();
        
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(context, AdminReceiver.class);
        
        if (dpm != null && dpm.isAdminActive(admin)) {
            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                    dpm.setUninstallBlocked(admin, context.getPackageName(), true);
                    Log.d(TAG, "✓ Desinstalación bloqueada");
                }
                
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    dpm.setKeyguardDisabled(admin, true);
                    Log.d(TAG, "✓ Keyguard bloqueado");
                }
                
                reportarAlerta(context, "admin_activado", "Administrador de dispositivo activado correctamente");
                actualizarEstadoEnRTDB(context, "admin_activado", true);
                
            } catch (SecurityException e) {
                Log.e(TAG, "Error de seguridad: " + e.getMessage());
                reportarAlerta(context, "admin_error", "Error al configurar admin: " + e.getMessage());
            } catch (Exception e) {
                Log.e(TAG, "Error en onEnabled: " + e.getMessage());
            }
        }
    }

    @Override
    public CharSequence onDisableRequested(@NonNull Context context, @NonNull Intent intent) {
        Log.w(TAG, "⚠️ Intento de desactivar administrador");
        
        reportarAlerta(context, "intento_desactivar_admin", 
            "⚠️ ALERTA: El usuario intentó quitar los permisos de administrador del dispositivo");
        
        try {
            DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
            if (dpm != null) {
                dpm.lockNow();
                Log.d(TAG, "✓ Pantalla bloqueada por intento de desactivación");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error bloqueando pantalla: " + e.getMessage());
        }
        
        return "⚠️ ADVERTENCIA DE SEGURIDAD\n" +
               "Esta acción será reportada a la Dirección de la SEDE.\n" +
               "EduControlPro continuará protegiendo el dispositivo.";
    }

    @Override
    public void onDisabled(@NonNull Context context, @NonNull Intent intent) {
        super.onDisabled(context, intent);
        Log.w(TAG, "!!! 🚨 ADMINISTRADOR DESACTIVADO 🚨 !!!");
        
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_ADMIN_ACTIVATED, false).apply();
        prefs.edit().putBoolean(KEY_BLOCK_MODE, false).apply();
        
        reportarAlerta(context, "admin_desactivado", 
            "🚨 ALERTA CRÍTICA: El administrador del dispositivo ha sido removido");
        
        actualizarEstadoEnRTDB(context, "admin_desactivado", false);
    }

    @Override
    public void onPasswordChanged(@NonNull Context context, @NonNull Intent intent) {
        super.onPasswordChanged(context, intent);
        Log.d(TAG, "Contraseña del dispositivo cambiada");
        reportarAlerta(context, "password_changed", "La contraseña del dispositivo fue cambiada");
    }

    @Override
    public void onPasswordFailed(@NonNull Context context, @NonNull Intent intent) {
        super.onPasswordFailed(context, intent);
        Log.w(TAG, "Intento de desbloqueo fallido");
        
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        int failedAttempts = prefs.getInt("failed_attempts", 0) + 1;
        prefs.edit().putInt("failed_attempts", failedAttempts).apply();
        
        if (failedAttempts >= 5) {
            reportarAlerta(context, "multiple_failed_attempts", 
                "🔐 Múltiples intentos fallidos de desbloqueo: " + failedAttempts);
        }
    }

    @Override
    public void onPasswordSucceeded(@NonNull Context context, @NonNull Intent intent) {
        super.onPasswordSucceeded(context, intent);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        int previousAttempts = prefs.getInt("failed_attempts", 0);
        prefs.edit().putInt("failed_attempts", 0).apply();
        
        if (previousAttempts > 0) {
            Log.d(TAG, "Desbloqueo exitoso después de " + previousAttempts + " intentos fallidos");
        }
    }

    private void actualizarEstadoEnRTDB(Context context, String estado, boolean valor) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String deviceId = prefs.getString("deviceId", null);
            String institutoId = prefs.getString(KEY_INSTITUTO_ID, null);
            
            if (deviceId == null || deviceId.isEmpty() || deviceId.equals("student_unknown")) {
                Log.w(TAG, "Device ID no disponible para actualizar estado");
                return;
            }
            
            DatabaseReference rtdb = FirebaseDatabase.getInstance().getReference();
            Map<String, Object> updates = new HashMap<>();
            updates.put("admin_activated", valor);
            updates.put("ultima_actualizacion", System.currentTimeMillis());
            updates.put("estado_ultimo", estado);
            updates.put("timestamp_admin", System.currentTimeMillis());
            
            if (institutoId != null && !institutoId.isEmpty()) {
                updates.put("InstitutoId", institutoId);
            }
            
            rtdb.child("status_dispositivos").child(deviceId).updateChildren(updates)
                .addOnSuccessListener(aVoid -> Log.d(TAG, "✓ Estado actualizado en RTDB: " + estado + " = " + valor))
                .addOnFailureListener(e -> Log.e(TAG, "✗ Error actualizando RTDB: " + e.getMessage()));
                
        } catch (Exception e) {
            Log.e(TAG, "Error en actualizarEstadoEnRTDB: " + e.getMessage());
        }
    }

    private void reportarAlerta(Context context, String tipo, String detalle) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String deviceId = prefs.getString("deviceId", "student_unknown");
            String institutoId = prefs.getString(KEY_INSTITUTO_ID, null);
            
            if (deviceId == null || deviceId.isEmpty()) {
                Log.w(TAG, "Device ID no disponible para reporte");
                return;
            }
            
            DatabaseReference rtdb = FirebaseDatabase.getInstance().getReference();
            Map<String, Object> data = new HashMap<>();
            data.put("timestamp", System.currentTimeMillis());
            data.put("detalle", detalle);
            data.put("tipo", tipo);
            data.put("deviceId", deviceId);
            data.put("fecha_human", new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new java.util.Date()));
            
            if (institutoId != null && !institutoId.isEmpty()) {
                data.put("InstitutoId", institutoId);
            }
            
            rtdb.child("alertas_seguridad").push().setValue(data);
            rtdb.child("monitoreo_dispositivos").child(deviceId).child("alertas_admin").push().setValue(data);
            rtdb.child("eventos_sistema").child(deviceId).child(tipo).push().setValue(data);
                
            Log.d(TAG, "✓ Alerta reportada: " + tipo);
            
        } catch (Exception e) {
            Log.e(TAG, "Error en reportarAlerta: " + e.getMessage());
        }
    }
    
    public static void setBlockMode(Context context, boolean enabled) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_BLOCK_MODE, enabled).apply();
        Log.d(TAG, "Modo blindaje total: " + (enabled ? "ACTIVADO 🔒" : "DESACTIVADO 🔓"));
        
        try {
            String deviceId = prefs.getString("deviceId", null);
            if (deviceId != null && !deviceId.isEmpty() && !deviceId.equals("student_unknown")) {
                Map<String, Object> updates = new HashMap<>();
                updates.put("block_mode_local", enabled);
                updates.put("ultima_actualizacion_block_mode", System.currentTimeMillis());
                FirebaseDatabase.getInstance().getReference()
                    .child("status_dispositivos")
                    .child(deviceId)
                    .updateChildren(updates);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error actualizando block_mode: " + e.getMessage());
        }
    }
    
    public static void setTechMode(Context context, boolean enabled) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_TECH_MODE, enabled).apply();
        Log.d(TAG, "Modo técnico (anulación): " + (enabled ? "ACTIVADO ⚙️" : "DESACTIVADO 🔄"));
        
        try {
            String deviceId = prefs.getString("deviceId", null);
            if (deviceId != null && !deviceId.isEmpty() && !deviceId.equals("student_unknown")) {
                Map<String, Object> updates = new HashMap<>();
                updates.put("tech_mode_local", enabled);
                updates.put("ultima_actualizacion_tech_mode", System.currentTimeMillis());
                FirebaseDatabase.getInstance().getReference()
                    .child("status_dispositivos")
                    .child(deviceId)
                    .updateChildren(updates);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error actualizando tech_mode: " + e.getMessage());
        }
    }
    
    public static boolean isAdminActivated(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean(KEY_ADMIN_ACTIVATED, false);
    }
    
    public static boolean isBlockModeActive(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean(KEY_BLOCK_MODE, false);
    }
    
    public static boolean isTechModeActive(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean(KEY_TECH_MODE, false);
    }
    
    public static String getInstitutoId(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_INSTITUTO_ID, null);
    }
}