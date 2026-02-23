export const dynamic = "force-static";
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'success', 
    message: 'Provisioning endpoint is ready (Static Mode)' 
  });
}
