'use client';

import React, { useState, useEffect, type ReactNode } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

interface FirebaseServices {
    firebaseApp: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [services, setServices] = useState<FirebaseServices | null>(null);

  useEffect(() => {
    // This effect runs only on the client, after the component has mounted.
    // This is the correct and safe place to initialize Firebase.
    const firebaseServices = initializeFirebase();
    setServices(firebaseServices);
  }, []); // Empty dependency array ensures this runs only once

  if (!services) {
    // While services are being initialized on the client, show a full-page loader.
    // This prevents any child components from trying to access Firebase before it's ready.
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
        <p className="mt-4 text-slate-400 font-medium tracking-widest uppercase">Initializing EFAS ServiControlPro...</p>
      </div>
    );
  }

  return (
    <FirebaseProvider
      firebaseApp={services.firebaseApp}
      auth={services.auth}
      firestore={services.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
