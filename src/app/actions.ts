
"use server";

import { z } from "zod";
import { generateAlertSummary } from "@/ai/flows/generate-alert-summary";
import type { GenerateAlertSummaryInput, GenerateAlertSummaryOutput } from "@/ai/flows/generate-alert-summary";
import { enhanceCctvImage } from "@/ai/flows/enhance-cctv-image";
import type { EnhanceCctvImageInput } from "@/ai/flows/enhance-cctv-image";

const VerificationInputSchema = z.object({
  selfieDataUri: z.string().startsWith("data:image/", { message: "Selfie must be a valid image data URI." }),
  cctvDataUri: z.string().startsWith("data:image/", { message: "CCTV frame must be a valid image data URI." }),
});

export type VerificationResult = 
  | { status: "verified"; message: string; selfieUsed?: string; }
  | { status: "failed"; summary: string; enhancedImageUri: string; message: string; selfieUsed?: string; }
  | { status: "error"; message: string; selfieUsed?: string; };

const SUCCESS_SUMMARY = "Verified successful: The same person is present in both images.";

export async function processVerification(
  prevState: any,
  formData: FormData
): Promise<VerificationResult> {
  let selfieDataUri: string | null = formData.get("programmaticSelfieDataUri") as string | null;
  const cctvDataUriFromForm = formData.get("cctvDataUri") as string | null;

  if (!selfieDataUri) {
    const selfieFile = formData.get("selfie") as File | null;
    if (!selfieFile) {
      return { status: "error", message: "Selfie image is required (either uploaded or provided programmatically)." };
    }
    try {
      const arrayBuffer = await selfieFile.arrayBuffer();
      const base64String = Buffer.from(arrayBuffer).toString('base64');
      selfieDataUri = `data:${selfieFile.type};base64,${base64String}`;
    } catch (error) {
      console.error("Error converting selfie to Data URI:", error);
      return { status: "error", message: "Failed to process uploaded selfie image." };
    }
  }

  if (!cctvDataUriFromForm) {
    return { status: "error", message: "CCTV frame is required. Please ensure camera is working." };
  }
  
  const validatedFields = VerificationInputSchema.safeParse({
    selfieDataUri: selfieDataUri,
    cctvDataUri: cctvDataUriFromForm, 
  });

  if (!validatedFields.success) {
    const fieldErrors = validatedFields.error.flatten().fieldErrors;
    const errorMessage = Object.values(fieldErrors).flat().join(' ');
    return {
      status: "error",
      message: `Invalid input: ${errorMessage || "Validation failed."}`,
      selfieUsed: selfieDataUri // Include the selfie used for context if validation fails
    };
  }

  const { selfieDataUri: validSelfieDataUri, cctvDataUri: validCctvDataUri } = validatedFields.data;

  try {
    const alertSummaryInput: GenerateAlertSummaryInput = {
      selfieDataUri: validSelfieDataUri,
      cctvDataUri: validCctvDataUri,
    };
    const alertSummaryOutput: GenerateAlertSummaryOutput = await generateAlertSummary(alertSummaryInput);

    if (alertSummaryOutput.summary === SUCCESS_SUMMARY) {
      return { status: "verified", message: "Identity verified successfully.", selfieUsed: validSelfieDataUri };
    } else {
      const enhanceCctvImageInput: EnhanceCctvImageInput = {
        cctvImageDataUri: validCctvDataUri,
      };
      const enhanceCctvImageOutput = await enhanceCctvImage(enhanceCctvImageInput);
      
      return {
        status: "failed",
        summary: alertSummaryOutput.summary,
        enhancedImageUri: enhanceCctvImageOutput.enhancedCctvImageDataUri,
        message: "Identity verification did not confirm a match.",
        selfieUsed: validSelfieDataUri,
      };
    }
  } catch (error) {
    console.error("Error during AI processing or backend tasks:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during AI processing.";
    return { status: "error", message: `Failed to get AI insights: ${errorMessage}`, selfieUsed: validSelfieDataUri };
  }
}
