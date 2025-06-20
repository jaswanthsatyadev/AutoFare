
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
  prompt: `You are a senior security analyst specialized in face verification systems. Your primary goal is to prevent false positives.

Task: Analyze a selfie and a separate CCTV image. Determine if the selfie face *convincingly matches* any face in the CCTV image. Your analysis must be critical.

IMPORTANT: The CCTV image may contain multiple people. Compare the selfie against **each individual face** in the CCTV image.

✅ Verification is **successful** ONLY IF:
- You find at least one face in the CCTV image that shows a **strong and unambiguous structural match** to the selfie across multiple key facial landmarks (e.g., eye spacing and shape, nose structure, jawline contour, overall facial proportions). The resemblance must be clear enough that you have a high degree of confidence they are the same person, despite superficial variations.

❌ Verification **fails** IF:
- After checking all faces, **no single face** in the CCTV image meets the "strong and unambiguous structural match" criteria.
- OR, if the closest-looking face in the CCTV still presents **at least one clear and undeniable structural difference** when compared to the selfie. If there's reasonable doubt due to a specific structural feature mismatch (not just angle or lighting), err on the side of caution and declare a failure, citing that difference.

⚠️ **Tolerate and IGNORE** these superficial variations for each comparison:
- Lighting, shadows, exposure.
- Facial expressions.
- Minor skin tone shifts (assume lighting differences).
- Hairstyles, hats, non-obscuring glasses, or accessories.
- Typical facial hair changes (e.g., beard growth, stubble vs. clean-shaven).
- Apparent changes due to moderate camera angle differences unless a core structural feature is fundamentally different.

🧠 Focus **strictly** on **persistent, underlying facial geometry**. Look for concrete differences in:
- Overall face shape (if distinctly different and not an angle artifact).
- Relative spacing and proportions of eyes, nose, and mouth.
- Fundamental nose structure (bridge, tip, nostrils – if clearly different).
- Jawline and chin contour (if demonstrably different).
- Ear shape and placement (if visible and clearly distinct).

Output:
1.  Provide **one single sentence**. No bullet points or extra explanation.
2.  If a match meeting the strict criteria above is found, respond: "Likely the same person."
3.  If no such match is found, state the most prominent structural difference that led to your conclusion of them being different individuals (e.g., "No individual in the CCTV image shares the same fundamental nose structure as the selfie." or "The distinct jawline shape in the selfie does not match any individual in the CCTV footage.").

Your default stance should be skepticism. Only confirm a match if the evidence is compelling.

Selfie: {{media url=selfieDataUri}}
CCTV Image: {{media url=cctvDataUri}}

Summary: `,
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

