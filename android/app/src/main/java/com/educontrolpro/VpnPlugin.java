package com.educontrolpro;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VpnPlugin")
public class VpnPlugin extends Plugin {

    private VpnController vpnController;

    @Override
    public void load() {
        vpnController = new VpnController(getActivity());
    }

    @PluginMethod
    public void activarVpn(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (getActivity() instanceof MainActivity) {
                    ((MainActivity) getActivity()).solicitarPermisoVpn();
                    call.resolve();
                } else {
                    vpnController.startVpn();
                    call.resolve();
                }
            } catch (Exception e) {
                call.reject("Error al activar VPN: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void desactivarVpn(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                vpnController.stopVpn();
                call.resolve();
            } catch (Exception e) {
                call.reject("Error al desactivar VPN: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void estaActiva(PluginCall call) {
        try {
            boolean activa = false;
            if (getActivity() instanceof MainActivity) {
                activa = ((MainActivity) getActivity()).isVpnActiva();
            }
            JSObject ret = new JSObject();
            ret.put("activa", activa);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al verificar VPN: " + e.getMessage());
        }
    }
}