package com.educontrolpro;

import android.os.Bundle;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.EditText;
import android.widget.Button;
import android.widget.LinearLayout;
import android.graphics.Color;
import android.view.Gravity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;
import java.util.HashMap;
import java.util.Map;

public class LockActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "AdminPrefs";
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_BLOQUEO_PIN = "bloqueo_pin";
    private static final String KEY_MASTER_PIN = "master_pin";

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private String deviceDocId = null;
    private String sitioBloqueado = "";
    private String tipoBloqueo = "SITIO";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // --- SEGURIDAD DE LA VENTANA ---
        // Evita que la actividad sea cerrada por toques accidentales o que se vea en "recientes"
        setFinishOnTouchOutside(false);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                             WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                             WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);

        // Obtener datos del intent
        if (getIntent() != null) {
            sitioBloqueado = getIntent().getStringExtra("sitio_bloqueado");
            if (sitioBloqueado == null) sitioBloqueado = "";
            
            String tipo = getIntent().getStringExtra("tipo_bloqueo");
            if (tipo != null) tipoBloqueo = tipo;
        }

        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        deviceDocId = capPrefs.getString("deviceId", "DEV-0001");

        // --- DISEÑO DE LA INTERFAZ ---
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#1A1A1A"));
        layout.setPadding(60, 80, 60, 80);

        TextView tvTitle = new TextView(this);
        tvTitle.setText("⚠️ ACCESO RESTRINGIDO");
        tvTitle.setTextColor(Color.parseColor("#FF4444"));
        tvTitle.setTextSize(26);
        tvTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        tvTitle.setGravity(Gravity.CENTER);
        tvTitle.setPadding(0, 0, 0, 30);

        TextView tvMessage = new TextView(this);
        if (tipoBloqueo.equals("CONFIGURACION")) {
            tvMessage.setText("Los ajustes del sistema están protegidos por EduControlPro.\n\nPresiona SALIR para volver.");
        } else {
            String msg = sitioBloqueado.isEmpty() ? "Esta acción no está permitida por el centro escolar." : 
                         "El acceso a '" + sitioBloqueado + "' está bloqueado.";
            tvMessage.setText(msg + "\n\nUsa un PIN docente para desbloqueo permanente.");
        }
        tvMessage.setTextColor(Color.WHITE);
        tvMessage.setTextSize(17);
        tvMessage.setGravity(Gravity.CENTER);
        tvMessage.setPadding(0, 0, 0, 50);

        // Botón "SALIR / CERRAR"
        Button btnExit = new Button(this);
        btnExit.setText("🚪 CERRAR Y VOLVER");
        btnExit.setPadding(0, 40, 0, 40);
        btnExit.setBackgroundColor(Color.parseColor("#333333"));
        btnExit.setTextColor(Color.WHITE);
        btnExit.setOnClickListener(v -> {
            registrarEvento("CIERRE_PANTALLA_BLOQUEO");
            finish();
        });

        // Separador visual
        TextView tvSeparator = new TextView(this);
        tvSeparator.setText("\n──────── ORDEN DOCENTE ────────\n");
        tvSeparator.setTextColor(Color.DKGRAY);
        tvSeparator.setGravity(Gravity.CENTER);

        // Input de PIN
        EditText inputPin = new EditText(this);
        inputPin.setHint("Ingrese PIN de 8 dígitos");
        inputPin.setHintTextColor(Color.GRAY);
        inputPin.setTextColor(Color.BLACK);
        inputPin.setBackgroundColor(Color.WHITE);
        inputPin.setGravity(Gravity.CENTER);
        inputPin.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        inputPin.setPadding(20, 30, 20, 30);
        
        // Botón Desbloqueo
        Button btnUnlock = new Button(this);
        btnUnlock.setText("DESBLOQUEAR DISPOSITIVO");
        btnUnlock.setBackgroundColor(Color.parseColor("#FFA500"));
        btnUnlock.setTextColor(Color.WHITE);
        btnUnlock.setOnClickListener(v -> {
            String pinIngresado = inputPin.getText().toString().trim();
            validarPin(pinIngresado);
        });

        // Construcción del Layout
        layout.addView(tvTitle);
        layout.addView(tvMessage);
        layout.addView(btnExit);
        layout.addView(tvSeparator);
        layout.addView(inputPin);
        layout.addView(new TextView(this)); // Espaciador
        layout.addView(btnUnlock);

        setContentView(layout);
    }

    private void validarPin(String pin) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        // Valores por defecto si no hay conexión a Firebase aún
        String pinDocente = prefs.getString(KEY_BLOQUEO_PIN, "12345678"); 
        String masterPin = prefs.getString(KEY_MASTER_PIN, "88888888");

        if (pin.equals(pinDocente) || pin.equals(masterPin)) {
            desbloquearPermanente();
        } else {
            SimpleLogger.w("PIN Incorrecto intentado: " + pin);
            Toast.makeText(this, "❌ PIN INCORRECTO", Toast.LENGTH_SHORT).show();
            registrarEvento("INTENTO_PIN_FALLIDO: " + pin);
        }
    }

    private void desbloquearPermanente() {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
                .putBoolean(KEY_UNLOCKED, true).apply();

        registrarEvento("DESBLOQUEO_PERMANENTE_LOCAL");
        
        Toast.makeText(this, "✅ Dispositivo Liberado", Toast.LENGTH_SHORT).show();
        
        // Enviamos al home para limpiar cualquier app bloqueada de fondo
        Intent homeIntent = new Intent(Intent.ACTION_MAIN);
        homeIntent.addCategory(Intent.CATEGORY_HOME);
        homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(homeIntent);
        
        finish();
    }

    private void registrarEvento(String tipo) {
        if (deviceDocId == null) return;
        Map<String, Object> log = new HashMap<>();
        log.put("tipo", tipo);
        log.put("sitio", sitioBloqueado);
        log.put("timestamp", FieldValue.serverTimestamp());
        
        db.collection("dispositivos").document(deviceDocId)
          .collection("incidencias").add(log);
    }

    @Override
    public void onBackPressed() {
        // Deshabilitado para que no escapen con el botón físico de atrás
    }
}