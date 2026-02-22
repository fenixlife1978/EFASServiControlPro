package com.educontrolpro;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.content.FileProvider;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class UpdateManager {
    private static final String TAG = "EDU_Update";
    private Context context;
    private FirebaseFirestore db = FirebaseFirestore.getInstance();

    public UpdateManager(Context context) {
        this.context = context;
    }

    public void listenForUpdates() {
        db.collection("config").document("app_status")
            .addSnapshotListener((snapshot, e) -> {
                if (e != null) return;
                if (snapshot != null && snapshot.exists()) {
                    checkVersion(snapshot);
                }
            });
    }

    private void checkVersion(DocumentSnapshot data) {
        try {
            Long cloudVersionLong = data.getLong("versionCode");
            int cloudVersion = (cloudVersionLong != null) ? cloudVersionLong.intValue() : 0;
            String downloadUrl = data.getString("downloadUrl");
            
            PackageInfo pInfo = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            int currentVersion = pInfo.versionCode;

            if (cloudVersion > currentVersion && downloadUrl != null) {
                Log.d(TAG, "Nueva versión detectada: " + cloudVersion);
                startDownload(downloadUrl);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error comparando versiones", e);
        }
    }

    private void startDownload(String urlString) {
        new Thread(() -> {
            try {
                URL url = new URL(urlString);
                HttpURLConnection c = (HttpURLConnection) url.openConnection();
                c.setRequestMethod("GET");
                c.connect();

                File file = new File(context.getExternalFilesDir(null), "update.apk");
                FileOutputStream fos = new FileOutputStream(file);
                InputStream is = c.getInputStream();

                byte[] buffer = new byte[1024];
                int len1;
                while ((len1 = is.read(buffer)) != -1) {
                    fos.write(buffer, 0, len1);
                }
                fos.close();
                is.close();

                installApk(file);
            } catch (Exception e) {
                Log.e(TAG, "Error de descarga: " + e.getMessage());
            }
        }).start();
    }

    private void installApk(File file) {
        Uri apkUri = FileProvider.getUriForFile(context, context.getPackageName() + ".provider", file);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }
}
