
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// In-memory store for the last received selfie for page.tsx to pick up
export let lastReceivedSelfieForPage: string | null = null;

const ReceivePhotoInputSchema = z.object({
  selfieDataUri: z.string().startsWith('data:image/', { message: "Selfie image data must be a valid data URI." }),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: NextRequest) {
  console.log("Received POST request to /api/receive-photo");
  // Log all incoming headers for diagnostic purposes
  const requestHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });
  console.log("Request headers:", JSON.stringify(requestHeaders, null, 2));

  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError: any) {
      console.error("Failed to parse JSON payload:", jsonError.message);
      let message = "Invalid JSON payload.";
      if (jsonError instanceof SyntaxError) {
        message = `Invalid JSON syntax: ${jsonError.message}. Ensure the request body is valid JSON.`;
      }
      
      const contentType = request.headers.get("content-type");
      if (!contentType || !contentType.toLowerCase().includes("application/json")) {
        message += " Also, ensure the 'Content-Type' header is set to 'application/json'.";
      }
      
      return NextResponse.json(
        { status: "error", message },
        { status: 400, headers: corsHeaders }
      );
    }

    const validatedFields = ReceivePhotoInputSchema.safeParse(body);

    if (!validatedFields.success) {
      const fieldErrors = validatedFields.error.flatten().fieldErrors;
      const errorMessages = Object.values(fieldErrors).flat();
      // Filter out undefined or null messages, though flat() should handle nested arrays.
      const errorMessageString = errorMessages.filter(msg => typeof msg === 'string').join(' ');
      
      console.error("Input validation failed:", JSON.stringify(validatedFields.error.flatten(), null, 2));
      return NextResponse.json(
        {
          status: "error",
          message: `Invalid input: ${errorMessageString || "Validation failed. Check selfieDataUri format."}`,
          errors: validatedFields.error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const { selfieDataUri } = validatedFields.data;

    lastReceivedSelfieForPage = selfieDataUri;

    return NextResponse.json(
      { status: "success", message: "Selfie received successfully. Awaiting processing by the main application." },
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
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
