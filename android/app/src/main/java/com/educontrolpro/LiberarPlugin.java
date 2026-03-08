package com.educontrolpro;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LiberarPlugin")
public class LiberarPlugin extends Plugin {

    @PluginMethod
    public void ejecutarLiberacion(PluginCall call) {
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.setAction("ACTION_LIBERAR_TAB");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        
        getContext().startActivity(intent);

        JSObject ret = new JSObject();
        ret.put("status", "comando_liberacion_enviado");
        call.resolve(ret);
    }

    @PluginMethod
    public void ejecutarRebloqueo(PluginCall call) {
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.setAction("ACTION_REBLOQUEAR_TAB");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        
        getContext().startActivity(intent);

        JSObject ret = new JSObject();
        ret.put("status", "comando_rebloqueo_enviado");
        call.resolve(ret);
    }
}