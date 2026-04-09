import SedeMonitorClient from './SedeMonitorClient';

export const dynamicParams = false;

export function generateStaticParams() {
  return []; 
}

interface PageProps {
  params: Promise<{ institutoId: string }>;
}

export default async function SedePage({ params }: PageProps) {
  const { institutoId } = await params;
  return <SedeMonitorClient institutoId={institutoId} />;
}
