import React from 'react';

export const LoadingOverlay = () => (
  <div className="fixed inset-0 bg-black/80 z-[9999] flex flex-col items-center justify-center text-white">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
    <p>Conectando con el servidor...</p>
  </div>
);