package com.educontrolpro;

import android.content.Intent;
import android.net.VpnService;
import android.os.Bundle;
import android.widget.Button;
import android.widget.Toast;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

public class VpnController extends AppCompatActivity {

    private Button btnStart, btnStop;
    private static final int VPN_REQUEST_CODE = 102;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_vpn_controller);

        btnStart = findViewById(R.id.button_start_vpn);
        btnStop = findViewById(R.id.button_stop_vpn);

        // Al iniciar, verificamos si ya está corriendo para ajustar los botones
        actualizarEstadoBotones();

        btnStart.setOnClickListener(v -> {
            SimpleLogger.i("VpnController: Intento de inicio manual del filtrado DNS");
            prepararVPN();
        });

        btnStop.setOnClickListener(v -> {
            SimpleLogger.w("VpnController: Intento de detención manual");
            detenerVPN();
        });
    }

    private void prepararVPN() {
        // VpnService.prepare devuelve null si el permiso ya fue concedido
        // (Esto pasará automáticamente gracias a que somos Device Owner)
        Intent intent = VpnService.prepare(this);
        if (intent != null) {
            startActivityForResult(intent, VPN_REQUEST_CODE);
        } else {
            // Permiso ya otorgado, procedemos directo
            onActivityResult(VPN_REQUEST_CODE, RESULT_OK, null);
        }
    }

    private void iniciarVPN() {
        Intent intent = new Intent(this, ParentalControlVpnService.class);
        intent.setAction("START_VPN");
        
        // Usamos startForegroundService en Android 8+ para evitar crashes
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
        
        btnStart.setEnabled(false);
        btnStop.setEnabled(true);
        SimpleLogger.i("VpnController: Comando de inicio enviado al servicio DNS");
        Toast.makeText(this, "Protección DNS Activada", Toast.LENGTH_SHORT).show();
    }

    private void detenerVPN() {
        Intent intent = new Intent(this, ParentalControlVpnService.class);
        intent.setAction("STOP_VPN");
        
        // Es mejor enviar un Action para que el servicio limpie los DNS antes de morir
        startService(intent);
        
        btnStart.setEnabled(true);
        btnStop.setEnabled(false);
        SimpleLogger.w("VpnController: Comando de detención enviado");
        Toast.makeText(this, "Protección DNS Desactivada", Toast.LENGTH_SHORT).show();
    }

    private void actualizarEstadoBotones() {
        // Podrías implementar un chequeo real aquí, por ahora manejamos el flujo visual
        // Si el AdminReceiver forzó Always-on, el botón de detener debería estar oculto o bloqueado.
        btnStop.setEnabled(true); 
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == VPN_REQUEST_CODE) {
            if (resultCode == RESULT_OK) {
                iniciarVPN();
            } else {
                SimpleLogger.e("VpnController: El usuario o el sistema rechazó el permiso de VPN");
                Toast.makeText(this, "Error: Se requiere permiso para filtrar contenido", Toast.LENGTH_LONG).show();
            }
        }
    }
}