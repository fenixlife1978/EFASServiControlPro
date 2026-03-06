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
import com.google.firebase.firestore.FieldValue; // Requerido para timestamps
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
    
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_MASTER_PIN = "master_pin";
    private static final String ADMIN_PREFS = "AdminPrefs";
    private static final String KEY_UNLOCKED = "is_unlocked";

    public UpdateManager(Context context) {
        this.context = context;
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

        // 2. Escuchar cambios en el PIN Maestro
        listenForSecurityChanges();

        // 3. NUEVO: Escuchar comandos de Bloqueo/Re-bloqueo por dispositivo
        listenForDeviceCommands();
    }

    private void listenForDeviceCommands() {
        String androidId = android.provider.Settings.Secure.getString(context.getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
        
        db.collection("dispositivos").document(androidId)
            .addSnapshotListener((snapshot, e) -> {
                if (e != null || snapshot == null || !snapshot.exists()) return;

                // Si en el Dashboard pones "admin_mode_enabled" en false, re-bloqueamos la tablet
                Boolean adminEnabled = snapshot.getBoolean("admin_mode_enabled");
                if (adminEnabled != null && !adminEnabled) {
                    ejecutarRebloqueoLocal();
                }
            });
    }

    private void ejecutarRebloqueoLocal() {
        SharedPreferences adminPrefs = context.getSharedPreferences(ADMIN_PREFS, Context.MODE_PRIVATE);
        boolean actualmenteDesbloqueado = adminPrefs.getBoolean(KEY_UNLOCKED, false);

        if (actualmenteDesbloqueado) {
            adminPrefs.edit().putBoolean(KEY_UNLOCKED, false).apply();
            Log.d(TAG, "🔒 Re-bloqueo ejecutado desde Dashboard");
            
            // Generar LOG de actividad automáticamente
            registrarActividad("SEGURIDAD_RESTAURADA", "El administrador bloqueó el dispositivo remotamente");
        }
    }

    public void registrarActividad(String tipo, String descripcion) {
        String androidId = android.provider.Settings.Secure.getString(context.getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
        
        Map<String, Object> log = new HashMap<>();
        log.put("tipo", tipo);
        log.put("descripcion", descripcion);
        log.put("timestamp", FieldValue.serverTimestamp());
        log.put("deviceId", androidId);

        // Esto creará la colección 'activity_logs' que no veías antes
        db.collection("activity_logs").add(log)
            .addOnSuccessListener(documentReference -> Log.d(TAG, "Log registrado"))
            .addOnFailureListener(e -> Log.e(TAG, "Error al crear log: " + e.getMessage()));
    }

    private void listenForSecurityChanges() {
        db.collection("system_config").document("security")
            .addSnapshotListener((snapshot, e) -> {
                if (e != null) return;
                if (snapshot != null && snapshot.exists()) {
                    String newPin = snapshot.getString("master_pin");
                    if (newPin != null) updateLocalPin(newPin);
                }
            });
    }

    private void updateLocalPin(String newPin) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_MASTER_PIN, newPin).apply();
        Log.d(TAG, "PIN Maestro sincronizado");
    }

    // ... (Mantén aquí abajo tus funciones checkVersion, startDownload y showUpdateNotification igual que antes)
    
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
