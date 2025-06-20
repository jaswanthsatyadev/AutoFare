
'use server';

/**
 * @fileOverview Generates a summary of a verification failure, including possible reasons.
 *
 * - generateAlertSummary - A function that generates the alert summary.
 * - GenerateAlertSummaryInput - The input type for the generateAlertSummary function.
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
  summary: z.string().describe('A single-sentence summary of the verification analysis, indicating if they are likely the same person or highlighting a key structural difference if they are likely different.'),
});
export type GenerateAlertSummaryOutput = z.infer<typeof GenerateAlertSummaryOutputSchema>;

export async function generateAlertSummary(input: GenerateAlertSummaryInput): Promise<GenerateAlertSummaryOutput> {
  return generateAlertSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAlertSummaryPrompt',
  input: {schema: GenerateAlertSummaryInputSchema},
  output: {schema: GenerateAlertSummaryOutputSchema},
  prompt: `You are a senior security analyst specialized in face verification systems. Your primary goal is to prevent false positives by being highly critical of apparent matches.

Task: Analyze a selfie and a separate CCTV image. You must determine if any face in the CCTV image is **convincingly and structurally** the same as the person in the selfie.

IMPORTANT: The CCTV image may contain multiple people. Compare the selfie against **each individual face** present in the CCTV image.

Superficial Variations to IGNORE (These should NOT be reasons for failure):
- Lighting, shadows, exposure.
- Facial expressions.
- Minor skin tone shifts.
- Hairstyles, hats, non-obscuring glasses, accessories.
- Typical facial hair changes (e.g., stubble vs. clean-shaven, moderate beard growth).
- Apparent changes due to moderate camera angle differences unless a core structural feature is fundamentally different.

Critical Structural Features to FOCUS ON:
- Overall face shape (if clearly different and not an angle artifact).
- Relative spacing and proportions of eyes, nose, and mouth.
- Fundamental nose structure (bridge, tip, nostrils – if clearly different).
- Jawline and chin contour (if demonstrably different).
- Ear shape and placement (if visible and clearly distinct).

Decision Criteria:
1.  **Match (Successful Verification):** If, after examining all faces in the CCTV image, you find at least one face that shows a **strong and unambiguous structural match** to the selfie across multiple key facial landmarks, and you have high confidence they are the same person.
2.  **No Match (Failed Verification):** If **NO face** in the CCTV image meets the "strong and unambiguous structural match" criteria. This includes scenarios where the closest-looking face still presents **at least one clear and undeniable structural difference** when compared to the selfie. If there's any reasonable doubt due to a specific structural feature mismatch, err on the side of caution and declare a failure.

Output Format (Strictly ONE sentence):
- If a match is found according to the criteria above: Respond **ONLY** with: "Likely the same person."
- If no match is found: Respond **ONLY** with a sentence stating the single most prominent structural difference that led to your conclusion of them being different individuals (e.g., "The jawline contour is fundamentally different." or "Nose bridge and eye spacing do not align.").

Your default stance must be skepticism. Only confirm a match if the evidence is compelling and free of significant structural discrepancies.
`,
});

const generateAlertSummaryFlow = ai.defineFlow(
  {
    name: 'generateAlertSummaryFlow',
    inputSchema: GenerateAlertSummaryInputSchema,
    outputSchema: GenerateAlertSummaryOutputSchema,
  },
  async input => {
    const {output, response} = await prompt(input);
    if (!output || !output.summary) {
      console.error('AI did not return a valid summary. Full AI response:', JSON.stringify(response, null, 2));
      throw new Error('AI failed to generate an alert summary. The response from the AI was empty, malformed, or missing the summary field.');
    }
    return output;
  }
);
