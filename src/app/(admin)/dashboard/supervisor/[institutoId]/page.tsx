import SedeMonitorClient from './SedeMonitorClient';

export async function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: { institutoId: string } }) {
  return <SedeMonitorClient institutoId={params.institutoId} />;
}
