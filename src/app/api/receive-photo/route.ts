
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// In-memory store for the last received selfie for page.tsx to pick up
// In a real application, you might use a more robust solution like a database, Redis, or a message queue.
export let lastReceivedSelfieForPage: string | null = null;

const ReceivePhotoInputSchema = z.object({
  selfieDataUri: z.string().startsWith('data:image/', { message: "Selfie image data must be a valid data URI." }),
  // cctvDataUri is no longer expected from the remote API caller
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error("Invalid JSON payload:", jsonError);
      return NextResponse.json(
        { status: "error", message: "Invalid JSON payload. Please ensure the request body is a valid JSON object." },
        { status: 400, headers: corsHeaders }
      );
    }

    const validatedFields = ReceivePhotoInputSchema.safeParse(body);

    if (!validatedFields.success) {
      const fieldErrors = validatedFields.error.flatten().fieldErrors;
      const errorMessage = Object.values(fieldErrors).flat().join(' ');
      return NextResponse.json(
        {
          status: "error",
          message: `Invalid input: ${errorMessage || "Validation failed."}`,
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const { selfieDataUri } = validatedFields.data;

    // Store the selfie for page.tsx to pick up
    lastReceivedSelfieForPage = selfieDataUri;

    // The API endpoint now only receives the selfie.
    // The comparison and AI processing will be triggered by page.tsx
    // when it polls for and finds this new selfie.
    return NextResponse.json(
      { status: "success", message: "Selfie received successfully. Awaiting processing by the main application." },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Error processing /api/receive-photo request:", error);
    let errorMessage = "An unknown error occurred while processing the photo via API.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json(
      { status: "error", message: errorMessage },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

