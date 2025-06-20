
"use server";

import { z } from "zod";
import { generateAlertSummary } from "@/ai/flows/generate-alert-summary";
import type { GenerateAlertSummaryInput } from "@/ai/flows/generate-alert-summary";
import { enhanceCctvImage } from "@/ai/flows/enhance-cctv-image";
import type { EnhanceCctvImageInput } from "@/ai/flows/enhance-cctv-image";

const VerificationInputSchema = z.object({
  selfieDataUri: z.string().startsWith("data:image/", { message: "Selfie must be a valid image data URI." }),
  cctvDataUri: z.string().startsWith("data:image/", { message: "CCTV frame must be a valid image data URI." }),
});

export type VerificationResult = 
  | { status: "verified"; message: string }
  | { status: "failed"; summary: string; enhancedImageUri: string; message: string }
  | { status: "error"; message: string };

export async function processVerification(
  prevState: any,
  formData: FormData
): Promise<VerificationResult> {
  const selfieFile = formData.get("selfie") as File | null;
  const cctvDataUriFromForm = formData.get("cctvDataUri") as string | null;

  if (!selfieFile) {
    return { status: "error", message: "Selfie image is required." };
  }
  if (!cctvDataUriFromForm) {
    return { status: "error", message: "CCTV frame is required. Please ensure camera is working." };
  }

  let selfieDataUri: string;
  try {
    const arrayBuffer = await selfieFile.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString('base64');
    selfieDataUri = `data:${selfieFile.type};base64,${base64String}`;
  } catch (error) {
    console.error("Error converting selfie to Data URI:", error);
    return { status: "error", message: "Failed to process selfie image." };
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
    };
  }

  const { selfieDataUri: validSelfieDataUri, cctvDataUri: validCctvDataUri } = validatedFields.data;

  const isMatch = Math.random() < 0.3; 

  if (isMatch) {
    console.log("Verification successful. Updating Firebase.");
    return { status: "verified", message: "Identity verified successfully." };
  } else {
    try {
      const alertSummaryInput: GenerateAlertSummaryInput = {
        selfieDataUri: validSelfieDataUri,
        cctvDataUri: validCctvDataUri,
      };
      const alertSummaryOutput = await generateAlertSummary(alertSummaryInput);

      const enhanceCctvImageInput: EnhanceCctvImageInput = {
        cctvImageDataUri: validCctvDataUri, // Note: schema uses cctvImageDataUri
      };
      const enhanceCctvImageOutput = await enhanceCctvImage(enhanceCctvImageInput);
      
      console.log("Verification failed. Logging alert and sending FCM.");

      return {
        status: "failed",
        summary: alertSummaryOutput.summary,
        enhancedImageUri: enhanceCctvImageOutput.enhancedCctvImageDataUri,
        message: "Identity verification failed.",
      };
    } catch (error) {
      console.error("Error during AI processing or simulated backend tasks:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during AI processing.";
      return { status: "error", message: `Failed to get AI insights: ${errorMessage}` };
    }
  }
}
