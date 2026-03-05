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
import android.view.ViewGroup;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.Toast;

public class LockActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "AdminPrefs";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String ADMIN_PIN = "1234"; // PIN de ejemplo, luego lo vincularemos a Firebase

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Flags de seguridad
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);

        // Crear layout dinámico
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.BLACK);
        layout.setPadding(50, 50, 50, 50);

        TextView tv = new TextView(this);
        tv.setText("ACCESO RESTRINGIDO\nEDUControlPro\n\nIntroduce PIN de Administrador:");
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(20);
        tv.setGravity(Gravity.CENTER);

        EditText inputPin = new EditText(this);
        inputPin.setHint("PIN");
        inputPin.setTextColor(Color.BLACK);
        inputPin.setBackgroundColor(Color.LTGRAY);
        inputPin.setGravity(Gravity.CENTER);
        inputPin.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        inputPin.setPadding(20, 20, 20, 20);

        Button btnUnlock = new Button(this);
        btnUnlock.setText("DESBLOQUEAR");
        btnUnlock.setOnClickListener(v -> {
            if (inputPin.getText().toString().equals(ADMIN_PIN)) {
                SharedPreferences.Editor editor = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit();
                editor.putBoolean(KEY_UNLOCKED, true);
                editor.apply();
                finish();
            } else {
                Toast.makeText(this, "PIN Incorrecto", Toast.LENGTH_SHORT).show();
            }
        });

        layout.addView(tv);
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
        Intent intent = new Intent(this, LockActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        startActivity(intent);
    }
}
