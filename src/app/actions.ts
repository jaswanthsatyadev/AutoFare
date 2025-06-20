
"use server";

import { z } from "zod";
import { generateAlertSummary } from "@/ai/flows/generate-alert-summary";
import type { GenerateAlertSummaryInput } from "@/ai/flows/generate-alert-summary";
import { enhanceCctvImage } from "@/ai/flows/enhance-cctv-image";
import type { EnhanceCctvImageInput } from "@/ai/flows/enhance-cctv-image";

const VerificationInputSchema = z.object({
  selfieDataUri: z.string().startsWith("data:image/", { message: "Selfie must be a valid image data URI." }),
  cctvDataUri: z.string().startsWith("data:image/", { message: "CCTV image must be a valid image data URI." }),
});

export type VerificationResult = 
  | { status: "verified"; message: string }
  | { status: "failed"; summary: string; enhancedImageUri: string; message: string }
  | { status: "error"; message: string };

// Placeholder for a 1x1 transparent PNG data URI
const TRANSPARENT_PNG_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";


export async function processVerification(
  prevState: any,
  formData: FormData
): Promise<VerificationResult> {
  const selfieFile = formData.get("selfie") as File | null;

  if (!selfieFile) {
    return { status: "error", message: "Selfie image is required." };
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
  
  // For this demonstration, we'll use a placeholder for the CCTV image data URI.
  // In a real application, this would be fetched from Firebase Storage or another source.
  const cctvDataUriForAI = TRANSPARENT_PNG_DATA_URI; 


  const validatedFields = VerificationInputSchema.safeParse({
    selfieDataUri: selfieDataUri,
    cctvDataUri: cctvDataUriForAI, 
  });

  if (!validatedFields.success) {
    return {
      status: "error",
      message: "Invalid input: " + validatedFields.error.flatten().fieldErrors,
    };
  }

  const { selfieDataUri: validSelfieDataUri, cctvDataUri: validCctvDataUri } = validatedFields.data;

  // Simulate face verification (e.g., DeepFace, OpenCV)
  // This part is mocked for the Next.js app.
  // In a real system, this would call a backend API (e.g., FastAPI).
  const isMatch = Math.random() < 0.3; // 30% chance of matching for demo

  if (isMatch) {
    // Simulate updating Firebase with verification status
    console.log("Verification successful. Updating Firebase.");
    return { status: "verified", message: "Identity verified successfully." };
  } else {
    // Verification failed, call AI flows
    try {
      const alertSummaryInput: GenerateAlertSummaryInput = {
        selfieDataUri: validSelfieDataUri,
        cctvDataUri: validCctvDataUri,
      };
      const alertSummaryOutput = await generateAlertSummary(alertSummaryInput);

      const enhanceCctvImageInput: EnhanceCctvImageInput = {
        cctvImageDataUri: validCctvDataUri,
      };
      const enhanceCctvImageOutput = await enhanceCctvImage(enhanceCctvImageInput);
      
      // Simulate logging alert to Firestore and sending FCM
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
