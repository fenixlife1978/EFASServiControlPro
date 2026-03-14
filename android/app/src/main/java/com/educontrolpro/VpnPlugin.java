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
            if (getActivity() instanceof MainActivity) {
                ((MainActivity) getActivity()).solicitarPermisoVpn();
                call.resolve();
            } else {
                call.reject("Actividad no es MainActivity");
            }
        });
    }

    @PluginMethod
    public void desactivarVpn(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (getActivity() instanceof MainActivity) {
                ((MainActivity) getActivity()).detenerVpn();
                call.resolve();
            } else {
                call.reject("Actividad no es MainActivity");
            }
        });
    }

    @PluginMethod
    public void estaActiva(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            boolean activa = ((MainActivity) getActivity()).isVpnActiva();
            JSObject ret = new JSObject();
            ret.put("activa", activa);
            call.resolve(ret);
        } else {
            call.reject("Actividad no es MainActivity");
        }
    }
}