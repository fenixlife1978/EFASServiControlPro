'use client';

import React, { createContext, useContext } from 'react';

// The context and provider are kept for structural reasons,
// but the initialization logic has been moved to src/firebase/config.ts
// to resolve import errors.
export const FirebaseContext = createContext<any>(undefined);

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseContext.Provider value={{}}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    // This should not happen if the provider is in the root layout.
    throw new Error('useFirebase must be used within a FirebaseClientProvider');
  }
  return context;
};
