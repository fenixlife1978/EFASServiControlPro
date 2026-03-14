package com.educontrolpro;

import android.content.Context;
import android.content.Intent;
import android.net.VpnService;
import android.app.Activity;
import androidx.activity.result.ActivityResultLauncher;

public class VpnController {

    private final Context context;
    public static final int VPN_REQUEST_CODE = 0x0F;

    public VpnController(Context context) {
        this.context = context;
    }

    /**
     * Inicia el servicio de VPN. 
     * Si no hay permisos, debe llamarse a prepararVpn primero desde una Activity.
     */
    public void startVpn() {
        try {
            SimpleLogger.i("VpnController: Iniciando comando de activación de VPN");
            Intent intent = new Intent(context, ParentalControlVpnService.class);
            intent.setAction("START_VPN");
            context.startService(intent);
        } catch (Exception e) {
            SimpleLogger.e("VpnController: Error al iniciar servicio: " + e.getMessage());
        }
    }

    /**
     * Detiene el servicio de VPN de forma segura.
     */
    public void stopVpn() {
        try {
            SimpleLogger.w("VpnController: Enviando comando de detención");
            Intent intent = new Intent(context, ParentalControlVpnService.class);
            intent.setAction("STOP_VPN");
            context.startService(intent);
        } catch (Exception e) {
            SimpleLogger.e("VpnController: Error al detener servicio: " + e.getMessage());
        }
    }

    /**
     * Verifica si el sistema ya tiene permisos para la VPN.
     * Si retorna un Intent, significa que se debe pedir permiso al usuario.
     */
    public void prepararVpn(Activity activity) {
        Intent intent = VpnService.prepare(activity);
        if (intent != null) {
            SimpleLogger.w("VpnController: Solicitando permisos de VPN al usuario");
            activity.startActivityForResult(intent, VPN_REQUEST_CODE);
        } else {
            SimpleLogger.i("VpnController: Permisos ya concedidos, iniciando...");
            startVpn();
        }
    }
}