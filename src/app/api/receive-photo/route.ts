
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateAlertSummary } from '@/ai/flows/generate-alert-summary';
import { enhanceCctvImage } from '@/ai/flows/enhance-cctv-image';
import type { GenerateAlertSummaryInput, GenerateAlertSummaryOutput } from '@/ai/flows/generate-alert-summary';
import type { EnhanceCctvImageInput } from '@/ai/flows/enhance-cctv-image';

const ReceivePhotoInputSchema = z.object({
  selfieDataUri: z.string().startsWith('data:image/', { message: "Selfie image must be a valid data URI." }),
  cctvDataUri: z.string().startsWith('data:image/', { message: "CCTV image must be a valid data URI." }),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow all origins
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST and OPTIONS methods
  'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Allow common headers
};

const SUCCESS_SUMMARY = "Verified successful: The same person is present in both images.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedFields = ReceivePhotoInputSchema.safeParse(body);

    if (!validatedFields.success) {
      return NextResponse.json(
        { 
          status: "error", 
          message: "Invalid input",
          errors: validatedFields.error.flatten().fieldErrors,
        }, 
        { 
          status: 400,
          headers: corsHeaders,
        }
      );
    }
    
    const { selfieDataUri, cctvDataUri } = validatedFields.data;
    
    const alertSummaryInput: GenerateAlertSummaryInput = { selfieDataUri, cctvDataUri };
    const alertSummaryOutput: GenerateAlertSummaryOutput = await generateAlertSummary(alertSummaryInput);

    if (alertSummaryOutput.summary === SUCCESS_SUMMARY) {
      return NextResponse.json(
        { status: "verified", message: "Identity verified successfully." },
        { status: 200, headers: corsHeaders }
      );
    } else {
      const enhanceCctvImageInput: EnhanceCctvImageInput = { cctvImageDataUri: cctvDataUri };
      const enhanceCctvImageOutput = await enhanceCctvImage(enhanceCctvImageInput);
      
      return NextResponse.json(
        {
          status: "failed",
          summary: alertSummaryOutput.summary,
          enhancedImageUri: enhanceCctvImageOutput.enhancedCctvImageDataUri,
          message: "Identity verification did not confirm a match.",
        },
        { status: 200, headers: corsHeaders }
      );
    }
  } catch (error) {
    console.error("Error in /api/receive-photo:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { status: "error", message: `Backend Error: ${errorMessage}` },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  // Handle preflight requests
  return new Response(null, {
    status: 204, // No Content
    headers: corsHeaders,
  });
}
