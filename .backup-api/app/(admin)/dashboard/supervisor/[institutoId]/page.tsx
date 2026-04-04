import React from 'react';
import SedeMonitorClient from './SedeMonitorClient';

interface PageProps {
  params: Promise<{ institutoId: string }>;
}

export default async function SedeMonitorPage({ params }: PageProps) {
  const resolvedParams = await params;
  const institutoId = resolvedParams.institutoId;
  
  return <SedeMonitorClient institutoId={institutoId} />;
}