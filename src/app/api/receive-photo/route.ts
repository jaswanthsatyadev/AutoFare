
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// This is a simplified in-memory store for the prototype.
// It allows the main page to poll for a selfie received by this API route.
export let lastReceivedSelfieForPage: string | null = null;

const ReceivePhotoInputSchema = z.object({
  selfieDataUri: z.string().startsWith('data:image/', { message: "Selfie image must be a valid data URI." }),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow all origins
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST and OPTIONS methods
  'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Allow common headers
};


export async function POST(request: NextRequest) {
  // Add logging for request headers for debugging
  const headers = Object.fromEntries(request.headers.entries());
  console.log('Received POST request headers:', headers);
  
  try {
    const body = await request.json();
    const validatedFields = ReceivePhotoInputSchema.safeParse(body);

    if (!validatedFields.success) {
      return NextResponse.json(
        { 
          status: "error", 
          message: "Invalid input. Ensure you are sending a JSON object with 'selfieDataUri' and check your 'Content-Type: application/json' header.",
          errors: validatedFields.error.flatten().fieldErrors,
        }, 
        { 
          status: 400,
          headers: corsHeaders,
        }
      );
    }
    
    // Store the selfie for the main page to poll
    lastReceivedSelfieForPage = validatedFields.data.selfieDataUri;
    console.log(`Received and stored new selfie for polling: ${lastReceivedSelfieForPage.substring(0, 50)}...`);

    return NextResponse.json(
        { status: "success", message: "Photo received successfully." },
        { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error in /api/receive-photo:", error);
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    // Check for JSON parsing errors specifically
    if (errorMessage.includes('Unexpected token')) {
        errorMessage = "Failed to parse JSON body. Please ensure the request body is valid JSON and the 'Content-Type' header is set to 'application/json'.";
    }

    return NextResponse.json(
      { status: "error", message: `Backend Error: ${errorMessage}` },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  // Handle preflight requests for CORS
  return new Response(null, {
    status: 204, // No Content
    headers: corsHeaders,
  });
}
