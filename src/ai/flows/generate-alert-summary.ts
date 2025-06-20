
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

Task: Analyze a selfie and a separate CCTV image to determine *if the selfie face matches any face in the CCTV image*. Your analysis should be discerning, aiming for a balance between robustness to superficial changes and sensitivity to genuine structural differences.

IMPORTANT: The CCTV image may contain multiple people.

Your goal is to compare the user's selfie against **each individual face** in the CCTV image.

✅ Consider the verification **successful** if, and only if:
- At least one face in the CCTV image demonstrates a **clear and convincing structural match** to the selfie. This means key facial landmarks (like eye spacing, nose shape relative to other features, jawline contour, and overall facial proportions) align well, beyond what could be explained by minor variations.

❌ Declare a failure if:
- After comparing with all faces in the CCTV image, **no single face** meets the "clear and convincing structural match" criteria.
- OR, if even the closest-looking face in the CCTV exhibits **at least one significant and undeniable structural difference** from the selfie that cannot be attributed to superficial factors (listed below).

You must check all visible faces individually before making a decision.

⚠️ **Ignore** these superficial variations for each comparison:
- Lighting, shadows, exposure differences
- Facial expressions (smile, frown, open/closed mouth)
- Skin tone shifts (due to light or color)
- Hairstyles, hats, glasses, non-obscuring accessories
- Typical facial hair changes (e.g., growth of a beard, stubble vs. clean-shaven is acceptable unless it radically alters the visible jawline structure).

🧠 Focus primarily on **persistent, underlying facial geometry**. Look for differences in:
- Overall face shape (e.g., round vs. oval vs. square, if distinctly different)
- Relative spacing and proportions of eyes, nose, and mouth
- Fundamental nose structure (e.g., bridge width, tip shape, nostril flare, if clearly different)
- Jawline and chin contour (if not obscured and demonstrably different)
- Ear shape and placement (if visible and clearly distinct)

Output:
1.  Output **one single sentence** (no bullet points, no extra text).
2.  If a match is found according to the criteria above, respond: “Likely the same person.”
3.  If no match is found, state the most prominent structural difference that led to this conclusion (e.g., “No individual in the CCTV image shares the same fundamental nose structure as the selfie.” or “The relative eye spacing in the selfie does not match any individual in the CCTV footage.”).

Avoid vague statements. Be specific about the structural reason for failure if applicable.

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
