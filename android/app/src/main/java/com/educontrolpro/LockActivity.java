package com.educontrolpro;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatActivity;
import android.widget.TextView;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.content.Intent;

public class LockActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Hacer la actividad a pantalla completa y sobre otras apps
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);

        // Diseño de bloqueo EDUControlPro
        TextView lockView = new TextView(this);
        lockView.setText("ACCESO RESTRINGIDO\n\nEDUControlPro\nSistema de Control Parental Educativo\n\nEsta aplicación no está permitida en este horario.");
        lockView.setTextColor(Color.WHITE);
        lockView.setTextSize(22);
        lockView.setGravity(Gravity.CENTER);
        lockView.setBackgroundColor(Color.BLACK);
        lockView.setPadding(40, 40, 40, 40);

        setContentView(lockView);
    }

    @Override
    public void onBackPressed() {
        // Bloquear el botón de atrás para que no puedan salir del bloqueo
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        // Si intentan usar el botón Home, la mandamos de nuevo al frente inmediatamente
        Intent intent = new Intent(this, LockActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        startActivity(intent);
    }
}
