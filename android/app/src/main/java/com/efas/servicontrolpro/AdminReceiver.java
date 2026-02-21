package com.efas.servicontrolpro;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;

public class AdminReceiver extends DeviceAdminReceiver {
    @Override
    public void onEnabled(Context context, Intent intent) {
        Toast.makeText(context, "EFAS: Device Owner Activado", Toast.LENGTH_SHORT).show();
    }
}
