
import { NextResponse } from 'next/server';
import { lastReceivedSelfieForPage } from '@/app/api/receive-photo/route';

// In a real app, this in-memory variable would be replaced with a more robust
// state management solution like a database or a message queue.
// It is exported from receive-photo/route.ts and imported here.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET() {
  const selfieToReturn = lastReceivedSelfieForPage;

  // This implementation returns the latest selfie if one exists.
  // The client-side logic in page.tsx is responsible for tracking which
  // selfie it has processed to avoid reprocessing the same one.
  return NextResponse.json(
    { selfieDataUri: selfieToReturn },
    { headers: corsHeaders }
  );
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
