
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ReceivePhotoInputSchema = z.object({
  imageDataUri: z.string().startsWith('data:image/', { message: "Image data must be a valid data URI (e.g., data:image/jpeg;base64,...)." }),
});

// Common headers for CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow all origins
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
        { message: "Invalid JSON payload. Please ensure the request body is a valid JSON object." },
        { status: 400, headers: corsHeaders }
      );
    }

    const validatedFields = ReceivePhotoInputSchema.safeParse(body);

    if (!validatedFields.success) {
      return NextResponse.json(
        {
          message: "Invalid input.",
          errors: validatedFields.error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const { imageDataUri } = validatedFields.data;

    // For now, just log a portion of the received data.
    // In a real application, you would process or store this image.
    console.log(`Received image data URI (length: ${imageDataUri.length}, first 50 chars): ${imageDataUri.substring(0, 50)}...`);

    // Here you could, for example, save the imageDataUri to a database,
    // pass it to an AI flow, or store it as a file.

    return NextResponse.json(
      { message: "Photo received successfully." },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("Error processing /api/receive-photo request:", error);
    let errorMessage = "An unknown error occurred while processing the photo.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json(
      { message: "Failed to process photo.", error: errorMessage },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204, // No Content
    headers: corsHeaders,
  });
}
