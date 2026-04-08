'use client';

import { use } from 'react';
import SedeMonitorClient from './SedeMonitorClient';

interface PageProps {
  params: Promise<{ institutoId: string }>;
}

export default function SedePage({ params }: PageProps) {
  const { institutoId } = use(params);
  return <SedeMonitorClient institutoId={institutoId} />;
}
