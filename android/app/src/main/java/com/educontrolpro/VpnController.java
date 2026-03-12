package com.educontrolpro;

import android.content.Intent;
import android.net.VpnService;
import android.os.Bundle;
import android.widget.Button;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class VpnController extends AppCompatActivity {

    private static final int VPN_REQUEST_CODE = 1000;
    private Button buttonStartVpn, buttonStopVpn;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_vpn_controller);

        buttonStartVpn = findViewById(R.id.button_start_vpn);
        buttonStopVpn = findViewById(R.id.button_stop_vpn);

        buttonStartVpn.setOnClickListener(v -> prepareAndStartVpn());
        buttonStopVpn.setOnClickListener(v -> stopVpnService());
    }

    private void prepareAndStartVpn() {
        Intent intent = VpnService.prepare(this);
        if (intent != null) {
            startActivityForResult(intent, VPN_REQUEST_CODE);
        } else {
            startVpnService();
        }
    }

    private void startVpnService() {
        Intent serviceIntent = new Intent(this, ParentalControlVpnService.class);
        startForegroundService(serviceIntent);
        buttonStartVpn.setEnabled(false);
        buttonStopVpn.setEnabled(true);
        Toast.makeText(this, "VPN Iniciada", Toast.LENGTH_SHORT).show();
    }

    private void stopVpnService() {
        Intent serviceIntent = new Intent(this, ParentalControlVpnService.class);
        stopService(serviceIntent);
        buttonStartVpn.setEnabled(true);
        buttonStopVpn.setEnabled(false);
        Toast.makeText(this, "VPN Detenida", Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == VPN_REQUEST_CODE) {
            if (resultCode == RESULT_OK) {
                startVpnService();
            } else {
                Toast.makeText(this, "Permiso de VPN denegado.", Toast.LENGTH_LONG).show();
            }
        }
    }
}