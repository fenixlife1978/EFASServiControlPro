package com.educontrolpro;

import android.content.Intent;
import android.net.VpnService;
import android.os.Bundle;
import android.widget.Button;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class VpnController extends AppCompatActivity {

    private Button btnStart, btnStop;
    private static final int VPN_REQUEST_CODE = 102;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_vpn_controller); // Asegúrate que el XML se llame así

        btnStart = findViewById(R.id.button_start_vpn);
        btnStop = findViewById(R.id.button_stop_vpn);

        btnStart.setOnClickListener(v -> {
            SimpleLogger.i("VpnController: Intento de inicio manual");
            prepararVPN();
        });

        btnStop.setOnClickListener(v -> {
            SimpleLogger.w("VpnController: Intento de detención manual");
            detenerVPN();
        });
    }

    private void prepararVPN() {
        Intent intent = VpnService.prepare(this);
        if (intent != null) {
            startActivityForResult(intent, VPN_REQUEST_CODE);
        } else {
            onActivityResult(VPN_REQUEST_CODE, RESULT_OK, null);
        }
    }

    private void iniciarVPN() {
        Intent intent = new Intent(this, ParentalControlVpnService.class);
        intent.setAction("START_VPN");
        startService(intent);
        
        btnStart.setEnabled(false);
        btnStop.setEnabled(true);
        SimpleLogger.i("VpnController: Servicio VPN enviado a iniciar");
        Toast.makeText(this, "VPN Iniciada", Toast.LENGTH_SHORT).show();
    }

    private void detenerVPN() {
        Intent intent = new Intent(this, ParentalControlVpnService.class);
        intent.setAction("STOP_VPN"); // Asegúrate de manejar este Action en el Service
        stopService(intent);
        
        btnStart.setEnabled(true);
        btnStop.setEnabled(false);
        SimpleLogger.w("VpnController: Servicio VPN detenido manualmente");
        Toast.makeText(this, "VPN Detenida", Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == VPN_REQUEST_CODE && resultCode == RESULT_OK) {
            iniciarVPN();
        }
    }
}