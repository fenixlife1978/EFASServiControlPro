'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SedeMonitorClient from './SedeMonitorClient';
import { Loader2 } from 'lucide-react';

function SedeMonitorContainer() {
  const searchParams = useSearchParams();
  const institutoId = searchParams?.get('institutoId');

  if (!institutoId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0c10] text-red-500 font-black uppercase italic tracking-wider">
        Error: No se especificó el ID de la Sede
      </div>
    );
  }

  return <SedeMonitorClient institutoId={institutoId} />;
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0c10]">
        <Loader2 className="animate-spin text-orange-500 w-10 h-10" />
      </div>
    }>
      <SedeMonitorContainer />
    </Suspense>
  );
}
