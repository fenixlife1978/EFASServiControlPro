'use client';

import SedeMonitorClient from './SedeMonitorClient';

interface PageProps {
  params: { institutoId: string };
}

export default function SedePage({ params }: PageProps) {
  const { institutoId } = params;
  return <SedeMonitorClient institutoId={institutoId} />;
}