
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
  prompt: `You are a senior security analyst specialized in face verification systems.

Task: Analyze a selfie and a separate CCTV image to determine *if the selfie face matches any face in the CCTV image*.

IMPORTANT: The CCTV image may contain multiple people.

Your goal is to compare the user's selfie against **each individual face** in the CCTV image. If **even one face** appears to structurally match the selfie, assume it is the **same person**.

✅ Consider the verification **successful** if:
- Any one face has a strong structural resemblance to the selfie face.

❌ Only declare a failure if:
- **None** of the faces match the selfie in terms of fundamental facial geometry (eye spacing, facial contours, jawline, etc.)

You must check all visible faces individually before making a decision.

⚠️ **Ignore** all superficial variations for each comparison:
- Lighting, shadows, exposure differences
- Facial expressions (smile, frown, open/closed mouth)
- Skin tone shifts (due to light or color)
- Hairstyles, hats, glasses, accessories
- Facial hair changes (other than radical transformations)

🧠 Focus only on major, structural facial differences that conclusively indicate two different people for any given comparison — such as fundamentally different face shape, eye spacing, nose structure, jawline, ear shape, or relative positioning of fixed facial landmarks.

Output:
1.  Output **one single sentence** (no bullet points, no extra text).
2.  If a match is found with any face in the CCTV image, respond: “Likely the same person.”
3.  If no match is found after checking all faces, state the most likely structural reason the person is not found (e.g., “No individual in the CCTV image shares the same distinct jawline as the selfie.”).

Avoid discussing lighting, expression, or appearance-based changes unless they strongly alter **fixed facial geometry**.

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

