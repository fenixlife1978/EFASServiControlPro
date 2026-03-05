package com.educontrolpro;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatActivity;
import android.widget.TextView;
import android.widget.EditText;
import android.widget.Button;
import android.widget.LinearLayout;
import android.graphics.Color;
import android.view.Gravity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.Toast;
import android.provider.Settings;

public class LockActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "AdminPrefs";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_MASTER_PIN = "master_pin"; // Llave para leer el PIN dinámico

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Flags de seguridad para mantenerse al frente
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);

        // Crear layout dinámico
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.BLACK);
        layout.setPadding(60, 60, 60, 60);

        // Título de advertencia en Rojo
        TextView tvTitle = new TextView(this);
        tvTitle.setText("ACCESO NO PERMITIDO");
        tvTitle.setTextColor(Color.RED);
        tvTitle.setTextSize(24);
        tvTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        tvTitle.setGravity(Gravity.CENTER);
        tvTitle.setPadding(0, 0, 0, 30);

        // Mensaje personalizado
        TextView tvMessage = new TextView(this);
        tvMessage.setText("EDUControlPro ha bloqueado este acceso por razones de seguridad y ha sido enviado un alerta de infraccion a la direccion de la SEDE.\n\nEVITA SER SANCIONADO");
        tvMessage.setTextColor(Color.WHITE);
        tvMessage.setTextSize(18);
        tvMessage.setGravity(Gravity.CENTER);
        tvMessage.setPadding(0, 0, 0, 50);

        // Campo para el PIN
        EditText inputPin = new EditText(this);
        inputPin.setHint("INTRODUCE PIN DOCENTE");
        inputPin.setHintTextColor(Color.GRAY);
        inputPin.setTextColor(Color.BLACK);
        inputPin.setBackgroundColor(Color.WHITE);
        inputPin.setGravity(Gravity.CENTER);
        inputPin.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        inputPin.setPadding(20, 20, 20, 20);

        // Botón de Desbloqueo
        Button btnUnlock = new Button(this);
        btnUnlock.setText("INGRESAR");
        btnUnlock.setOnClickListener(v -> {
            // --- CAMBIO CLAVE: Leer PIN dinámico de SharedPreferences ---
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String pinActual = prefs.getString(KEY_MASTER_PIN, "1234"); // "1234" es el respaldo inicial

            if (inputPin.getText().toString().equals(pinActual)) {
                // 1. Guardar estado desbloqueado
                SharedPreferences.Editor editor = prefs.edit();
                editor.putBoolean(KEY_UNLOCKED, true);
                editor.apply();
                
                Toast.makeText(this, "MODO ADMINISTRADOR ACTIVADO", Toast.LENGTH_SHORT).show();
                
                // 2. Abrir Ajustes automáticamente para el admin
                Intent intent = new Intent(Settings.ACTION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                
                finish(); // Cerrar pantalla de bloqueo
            } else {
                Toast.makeText(this, "PIN Incorrecto - Intento registrado", Toast.LENGTH_SHORT).show();
            }
        });

        // Agregar vistas al layout
        layout.addView(tvTitle);
        layout.addView(tvMessage);
        layout.addView(inputPin);
        layout.addView(btnUnlock);

        setContentView(layout);
    }

    @Override
    public void onBackPressed() {
        // Bloquear botón atrás
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        // Si intentan minimizar, relanzar
        Intent intent = new Intent(this, LockActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        startActivity(intent);
    }
}
