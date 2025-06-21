
'use server';

/**
 * @fileOverview Generates a summary of a verification failure, including possible reasons.
 *
 * - generateAlertSummary - A function that generates the alert summary.
 * - GenerateAlertSummaryInput - The input type for the generateAlertsummary function.
 * - GenerateAlertSummaryOutput - The return type for the generateAlertSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAlertSummaryInputSchema = z.object({
  selfieDataUri: z
    .string()
    .describe(
      "The user's selfie as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  cctvDataUri: z
    .string()
    .describe(
      "The CCTV image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateAlertSummaryInput = z.infer<typeof GenerateAlertSummaryInputSchema>;

const GenerateAlertSummaryOutputSchema = z.object({
  summary: z.string().describe("A single-sentence summary of the verification analysis. It will state if the same person is present, if no match is found, or if the determination cannot be made with confidence."),
});
export type GenerateAlertSummaryOutput = z.infer<typeof GenerateAlertSummaryOutputSchema>;

export async function generateAlertSummary(input: GenerateAlertSummaryInput): Promise<GenerateAlertSummaryOutput> {
  return generateAlertSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAlertSummaryPrompt',
  input: {schema: GenerateAlertSummaryInputSchema},
  output: {schema: GenerateAlertSummaryOutputSchema},
  prompt: `You are a meticulous forensic facial comparison expert. Your primary goal is to determine if the same individual appears in two separate images (a selfie and a CCTV snapshot) with the highest possible accuracy. Do not be easily convinced; scrutinize every detail.

Step 1: Image Quality Assessment
First, for both the selfie and the CCTV image, assess the quality. Note factors like: lighting (harsh shadows, overexposure), resolution (blurriness, pixelation), obstructions (hair, hands, objects), and camera angle (frontal, profile, tilted).

Step 2: Facial Landmark Analysis
For each clear face in both images, identify and compare key facial landmarks. Analyze the spatial relationship and proportions between: the inner and outer corners of the eyes, the tip of the nose, the corners of the mouth, and the chin.

Step 3: Feature-by-Feature Comparison
Perform a detailed comparison of individual features:
- Eyes: Shape, size, spacing, and eyebrow shape.
- Nose: Bridge width, tip shape, and nostril flare.
- Mouth: Lip thickness, mouth width, and shape.
- Face Shape: Overall head shape, jawline definition, and chin structure.
- Unique Identifiers: Look for any consistent moles, scars, or other permanent marks.

Step 4: Synthesis and Reasoning
Synthesize your findings. State how many points of similarity and discrepancy you found. Account for variations due to lighting, expression, and angle. Based on your analysis, make a final determination.

Step 5: Final Output
Provide your final conclusion in a single sentence for the 'summary' field, choosing ONLY from the following exact phrases:
- "Verified successful: The same person is present in both images."
- "No matching person found in both images."
- "Unable to determine with confidence."

Image 1 (Selfie): {{media url=selfieDataUri}}
Image 2 (CCTV): {{media url=cctvDataUri}}`,
});

const generateAlertSummaryFlow = ai.defineFlow(
  {
    name: 'generateAlertSummaryFlow',
    inputSchema: GenerateAlertSummaryInputSchema,
    outputSchema: GenerateAlertSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output || !output.summary) {
      console.error('AI did not return a valid summary.');
      throw new Error('AI failed to generate an alert summary. The response from the AI was empty, malformed, or missing the summary field.');
    }
    return output;
  }
);
