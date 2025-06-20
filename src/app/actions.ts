
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
  | { status: "verified"; message: string }
  | { status: "failed"; summary: string; enhancedImageUri: string; message: string }
  | { status: "error"; message: string };

const SUCCESS_SUMMARY = "Verified successful: The same person is present in both images.";

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

  try {
    const alertSummaryInput: GenerateAlertSummaryInput = {
      selfieDataUri: validSelfieDataUri,
      cctvDataUri: validCctvDataUri,
    };
    const alertSummaryOutput: GenerateAlertSummaryOutput = await generateAlertSummary(alertSummaryInput);

    if (alertSummaryOutput.summary === SUCCESS_SUMMARY) {
      console.log("Verification successful based on AI summary. Updating Firebase.");
      // TODO: Implement Firebase update for successful verification
      return { status: "verified", message: "Identity verified successfully." };
    } else {
      // AI indicates a mismatch or uncertainty
      const enhanceCctvImageInput: EnhanceCctvImageInput = {
        cctvImageDataUri: validCctvDataUri,
      };
      const enhanceCctvImageOutput = await enhanceCctvImage(enhanceCctvImageInput);
      
      console.log("Verification failed or uncertain based on AI summary. Logging alert and sending FCM.");
      // TODO: Implement alert logging and FCM notification for failed verification

      return {
        status: "failed",
        summary: alertSummaryOutput.summary, // This will now be "No matching person..." or "Unable to determine..."
        enhancedImageUri: enhanceCctvImageOutput.enhancedCctvImageDataUri,
        message: "Identity verification did not confirm a match.", // More generic message
      };
    }
  } catch (error) {
    console.error("Error during AI processing or backend tasks:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during AI processing.";
    return { status: "error", message: `Failed to get AI insights: ${errorMessage}` };
  }
}
