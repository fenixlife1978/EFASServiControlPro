package com.educontrolpro;

import android.content.Context;
import android.content.Intent;
import android.net.VpnService;
import android.app.Activity;
import android.util.Log;

public class VpnController {

    private final Context context;
    public static final int VPN_REQUEST_CODE = 0x0F;
    private static final String TAG = "VpnController";

    public VpnController(Context context) {
        this.context = context;
    }

    /**
     * Inicia el servicio de VPN con el paquete de la app excluido automáticamente
     */
    public void startVpn() {
        try {
            SimpleLogger.i("VpnController: Iniciando comando de activación de VPN");
            Intent intent = new Intent(context, ParentalControlVpnService.class);
            intent.setAction(ParentalControlVpnService.ACTION_START_VPN);
            intent.putExtra("package_name", context.getPackageName()); // Enviar package name
            context.startService(intent);
            Log.d(TAG, "Comando START_VPN enviado");
        } catch (Exception e) {
            SimpleLogger.e("VpnController: Error al iniciar servicio: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Detiene el servicio de VPN de forma segura
     */
    public void stopVpn() {
        try {
            SimpleLogger.w("VpnController: Enviando comando de detención");
            Intent intent = new Intent(context, ParentalControlVpnService.class);
            intent.setAction(ParentalControlVpnService.ACTION_STOP_VPN);
            context.startService(intent);
            Log.d(TAG, "Comando STOP_VPN enviado");
        } catch (Exception e) {
            SimpleLogger.e("VpnController: Error al detener servicio: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Verifica si la VPN está activa mirando el estado del servicio
     */
    public boolean isVpnActive() {
        // Este método requeriría una forma de consultar el estado
        // Podrías usar una variable estática o BroadcastReceiver
        return false; // Implementar según necesidad
    }

    /**
     * Prepara la VPN solicitando permisos si es necesario
     */
    public void prepararVpn(Activity activity) {
        Intent intent = VpnService.prepare(activity);
        if (intent != null) {
            SimpleLogger.w("VpnController: Solicitando permisos de VPN al usuario");
            // Usar el nuevo API de ActivityResultContracts en lugar de startActivityForResult deprecated
            if (activity instanceof MainActivity) {
                ((MainActivity) activity).solicitarPermisoVpn();
            } else {
                activity.startActivityForResult(intent, VPN_REQUEST_CODE);
            }
        } else {
            SimpleLogger.i("VpnController: Permisos ya concedidos, iniciando...");
            startVpn();
        }
    }
}