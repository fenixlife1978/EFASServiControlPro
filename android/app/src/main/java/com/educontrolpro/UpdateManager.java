
package com.educontrolpro;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

public class UpdateManager {
    private static final String TAG = "EDU_Update";
    private Context context;
    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private static final String CHANNEL_ID = "update_channel";
    
    // Preferencias correctas
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String ADMIN_PREFS = "AdminPrefs";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String KEY_BLOQUEO_PIN = "bloqueo_pin";
   
    private String deviceId = null;
   
    public UpdateManager(Context context) {
        this.context = context;
        
        // Obtener deviceId desde CapacitorStorage
        SharedPreferences capPrefs = context.getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE);
        deviceId = capPrefs.getString(KEY_DEVICE_ID, null);
        
        if (deviceId == null) {
            Log.w(TAG, "No hay deviceId disponible aún (dispositivo no vinculado)");
        }
    }
   
    public void listenForUpdates() {
        // 1. Escuchar actualizaciones de versión
        db.collection("config").document("app_status")
            .addSnapshotListener((snapshot, e) -> {
                if (e != null) return;
                if (snapshot != null && snapshot.exists()) {
                    checkVersion(snapshot);
                }
            });
      
        // 2. Escuchar cambios en el PIN de BLOQUEO (específico del dispositivo)
        listenForPinChanges();
     
        // 3. Escuchar comandos de Bloqueo/Re-bloqueo por dispositivo
        listenForDeviceCommands();
    }
   
    private void listenForDeviceCommands() {
        if (deviceId == null) return;
        
        db.collection("dispositivos").document(deviceId)
            .addSnapshotListener((snapshot, e) -> {
                if (e != null || snapshot == null || !snapshot.exists()) return;
             
                // Si en el Dashboard ponen "admin_mode_enable" en false, re-bloqueamos
                Boolean adminEnabled = snapshot.getBoolean("admin_mode_enable");
                Boolean bloquearComando = snapshot.getBoolean("bloquear");
                
                if (adminEnabled != null && !adminEnabled) {
                    ejecutarRebloqueoLocal("admin_mode_desactivado");
                }
                
                // Comando de bloqueo inmediato
                if (bloquearComando != null && bloquearComando) {
                    ejecutarRebloqueoLocal("comando_bloquear");
                    
                    // Resetear el comando después de 2 segundos
                    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                        if (deviceId != null) {
                            db.collection("dispositivos").document(deviceId)
                                .update("bloquear", false);
                        }
                    }, 2000);
                }
            });
    }
  
    private void listenForPinChanges() {
        if (deviceId == null) return;
        
        db.collection("dispositivos").document(deviceId)
            .addSnapshotListener((snapshot, e) -> {
                if (e != null || snapshot == null || !snapshot.exists()) return;
                
                String newPin = snapshot.getString("pinBloqueo");
                if (newPin != null && !newPin.isEmpty()) {
                    updateLocalPin(newPin);
                }
            });
    }
  
    private void ejecutarRebloqueoLocal(String razon) {
        SharedPreferences adminPrefs = context.getSharedPreferences(ADMIN_PREFS, Context.MODE_PRIVATE);
        boolean actualmenteDesbloqueado = adminPrefs.getBoolean(KEY_UNLOCKED, false);
    
        if (actualmenteDesbloqueado) {
            adminPrefs.edit().putBoolean(KEY_UNLOCKED, false).apply();
            Log.d(TAG, "🔒 Re-bloqueo ejecutado: " + razon);
            
            // Registrar actividad
            registrarActividad("SEGURIDAD_RESTAURADA", "Bloqueo remoto: " + razon);
            
            // Forzar el inicio de LockActivity si es necesario
            Intent lockIntent = new Intent(context, LockActivity.class);
            lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(lockIntent);
        }
    }
  
    public void registrarActividad(String tipo, String descripcion) {
        if (deviceId == null) return;
        
        Map<String, Object> log = new HashMap<>();
        log.put("tipo", tipo);
        log.put("descripcion", descripcion);
        log.put("timestamp", FieldValue.serverTimestamp());
        log.put("deviceId", deviceId);
    
        db.collection("activity_logs").add(log)
            .addOnSuccessListener(documentReference -> Log.d(TAG, "Log registrado"))
            .addOnFailureListener(e -> Log.e(TAG, "Error al crear log: " + e.getMessage()));
    }
  
    private void updateLocalPin(String newPin) {
        SharedPreferences prefs = context.getSharedPreferences(ADMIN_PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_BLOQUEO_PIN, newPin).apply();
        Log.d(TAG, "PIN de bloqueo sincronizado: " + newPin);
    }
 
    private void checkVersion(DocumentSnapshot data) {
        try {
            Long cloudVersionLong = data.getLong("versionCode");
            int cloudVersion = (cloudVersionLong != null) ? cloudVersionLong.intValue() : 0;
            String downloadUrl = data.getString("downloadUrl");
            PackageInfo pInfo = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            int currentVersion = pInfo.versionCode;
            if (cloudVersion > currentVersion && downloadUrl != null) {
                startDownload(downloadUrl);
            }
        } catch (Exception e) { Log.e(TAG, "Error version", e); }
    }
  
    private void startDownload(String urlString) {
        new Thread(() -> {
            try {
                URL url = new URL(urlString);
                HttpURLConnection c = (HttpURLConnection) url.openConnection();
                c.connect();
                File file = new File(context.getExternalFilesDir(null), "update.apk");
                FileOutputStream fos = new FileOutputStream(file);
                InputStream is = c.getInputStream();
                byte[] buffer = new byte[4096];
                int len;
                while ((len = is.read(buffer)) != -1) { fos.write(buffer, 0, len); }
                fos.close(); is.close();
                showUpdateNotification(file);
            } catch (Exception e) { Log.e(TAG, "Error download", e); }
        }).start();
    }
  
    private void showUpdateNotification(File file) {
        Uri apkUri = FileProvider.getUriForFile(context, context.getPackageName() + ".provider", file);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) { flags |= PendingIntent.FLAG_IMMUTABLE; }
        PendingIntent pIntent = PendingIntent.getActivity(context, 0, intent, flags);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Actualizaciones", NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(channel);
        }
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle("Actualización Crítica")
                .setContentText("Instale la nueva versión.")
                .setAutoCancel(true)
                .setOngoing(true)
                .setContentIntent(pIntent);
        nm.notify(2, builder.build());
    }
}
