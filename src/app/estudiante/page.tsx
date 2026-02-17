'use client';
import React, { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { registerPlugin } from '@capacitor/core';

// Definimos la interfaz del plugin para TypeScript
const DeviceControl = registerPlugin<any>('DeviceControl');

const APPS_PERMITIDAS = [
  { id: 1, nombre: 'Matemáticas', icon: '🧮', package: 'com.android.calculator2' },
  { id: 2, nombre: 'Diccionario', icon: '📖', package: 'com.google.android.apps.books' },
  { id: 3, nombre: 'Navegador', icon: '🌐', package: 'com.android.chrome' },
  { id: 4, nombre: 'Cámara', icon: '📸', package: 'com.android.camera' },
];

export default function EstudiantePage() {
  const tabletId = "TABLET_01"; // Esto debería venir de la configuración de la tablet

  useEffect(() => {
    // Listener de Firebase para el Bloqueo Remoto
    const unsub = onSnapshot(doc(db, "dispositivos", tabletId), (doc) => {
      const data = doc.data();
      if (data?.comando_bloqueo === true) {
        console.log("Orden de bloqueo recibida...");
        DeviceControl.lockDevice();
      }
    });

    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-black italic uppercase tracking-tighter text-orange-500">
          EFAS <span className="text-white">ServControlPro</span>
        </h1>
        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mt-2">
          Entorno de Aprendizaje Supervisado
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
        {APPS_PERMITIDAS.map((app) => (
          <button
            key={app.id}
            className="group flex flex-col items-center p-8 bg-slate-900 border-2 border-slate-800 rounded-[2.5rem] hover:border-orange-500 transition-all active:scale-95"
          >
            <span className="text-6xl mb-4 group-hover:scale-110 transition-transform">
              {app.icon}
            </span>
            <span className="font-black italic uppercase text-sm tracking-tight text-slate-300 group-hover:text-white">
              {app.nombre}
            </span>
          </button>
        ))}
      </div>

      <footer className="fixed bottom-8 left-0 right-0 text-center">
        <div className="inline-block px-6 py-2 bg-slate-900 rounded-full border border-slate-800">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
            Dispositivo Protegido por EFAS Guardian
          </span>
        </div>
      </footer>
    </div>
  );
}
