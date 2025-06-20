
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateAlertSummary, type GenerateAlertSummaryInput, type GenerateAlertSummaryOutput } from "@/ai/flows/generate-alert-summary";
import { enhanceCctvImage, type EnhanceCctvImageInput } from "@/ai/flows/enhance-cctv-image";
import type { VerificationResult } from "@/app/actions"; // Re-using the type from actions

const ReceivePhotoInputSchema = z.object({
  selfieDataUri: z.string().startsWith('data:image/', { message: "Selfie image data must be a valid data URI." }),
  cctvDataUri: z.string().startsWith('data:image/', { message: "CCTV image data must be a valid data URI." }),
});

const SUCCESS_SUMMARY = "Verified successful: The same person is present in both images.";

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
        { status: "error", message: "Invalid JSON payload. Please ensure the request body is a valid JSON object." } satisfies VerificationResult,
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
        } satisfies VerificationResult,
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const { selfieDataUri, cctvDataUri } = validatedFields.data;

    try {
      const alertSummaryInput: GenerateAlertSummaryInput = {
        selfieDataUri: selfieDataUri,
        cctvDataUri: cctvDataUri,
      };
      const alertSummaryOutput: GenerateAlertSummaryOutput = await generateAlertSummary(alertSummaryInput);

      if (alertSummaryOutput.summary === SUCCESS_SUMMARY) {
        // console.log("Verification successful via API based on AI summary.");
        return NextResponse.json(
          { status: "verified", message: "Identity verified successfully via API." } satisfies VerificationResult,
          { status: 200, headers: corsHeaders }
        );
      } else {
        // AI indicates a mismatch or uncertainty
        const enhanceCctvImageInput: EnhanceCctvImageInput = {
          cctvImageDataUri: cctvDataUri,
        };
        const enhanceCctvImageOutput = await enhanceCctvImage(enhanceCctvImageInput);
        
        // console.log("Verification failed or uncertain via API based on AI summary.");
        return NextResponse.json(
          {
            status: "failed",
            summary: alertSummaryOutput.summary, // This will be "No matching person..." or "Unable to determine..."
            enhancedImageUri: enhanceCctvImageOutput.enhancedCctvImageDataUri,
            message: "Identity verification did not confirm a match via API.",
          } satisfies VerificationResult,
          { status: 200, headers: corsHeaders } // Still 200 OK as the API processed the request
        );
      }
    } catch (error) {
      console.error("Error during AI processing for API request:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during AI processing.";
      return NextResponse.json(
        { status: "error", message: `Failed to get AI insights via API: ${errorMessage}` } satisfies VerificationResult,
        { status: 500, headers: corsHeaders }
      );
    }

  } catch (error) {
    console.error("Outer error processing /api/receive-photo request:", error);
    let errorMessage = "An unknown error occurred while processing the photo via API.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json(
      { status: "error", message: errorMessage } satisfies VerificationResult,
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
