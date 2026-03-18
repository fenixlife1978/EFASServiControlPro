package com.educontrolpro;

import android.util.Log;

public class SimpleLogger {
    private static final String TAG = "EduControlPro";

    // Niveles de Log - AHORA SOLO LOCALES
    public static void i(String message) {
        Log.i(TAG, message);
    }

    public static void e(String message) {
        Log.e(TAG, message);
    }

    public static void d(String message) {
        Log.d(TAG, message);
    }

    public static void w(String message) {
        Log.w(TAG, message);
    }

    // Versiones con TAG personalizado para mejor organización
    public static void i(String tag, String message) {
        Log.i(TAG + "/" + tag, message);
    }

    public static void e(String tag, String message) {
        Log.e(TAG + "/" + tag, message);
    }

    public static void d(String tag, String message) {
        Log.d(TAG + "/" + tag, message);
    }

    public static void w(String tag, String message) {
        Log.w(TAG + "/" + tag, message);
    }
}