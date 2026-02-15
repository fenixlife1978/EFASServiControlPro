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
    const firebaseServices = initializeFirebase();
    
    // CRITICAL: Only set the state if initialization was successful.
    // A successful initialization means firebaseApp is not null.
    if (firebaseServices && firebaseServices.firebaseApp) {
        setServices(firebaseServices);
    }
    // If initialization fails (e.g., missing API key), 'services' remains null,
    // and the loader will continue to be displayed. The console will show
    // the warning from 'initializeFirebase'.
  }, []); // Empty dependency array ensures this runs only once

  if (!services) {
    // This loader is now correctly shown if services are null (i.e., not yet initialized
    // OR initialization failed due to missing config).
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
        <p className="mt-4 text-slate-400 font-medium tracking-widest uppercase">Initializing EFAS ServiControlPro...</p>
      </div>
    );
  }

  // This part is only reached if 'services' is not null, meaning all services are available.
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
