
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
  summary: z.string().describe('A single-sentence summary of the verification analysis. It will state if the same person is present, if no match is found, or if the determination cannot be made with confidence.'),
});
export type GenerateAlertSummaryOutput = z.infer<typeof GenerateAlertSummaryOutputSchema>;

export async function generateAlertSummary(input: GenerateAlertSummaryInput): Promise<GenerateAlertSummaryOutput> {
  return generateAlertSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAlertSummaryPrompt',
  input: {schema: GenerateAlertSummaryInputSchema},
  output: {schema: GenerateAlertSummaryOutputSchema},
  prompt: `Role:
You are an advanced AI face recognition system. Your task is to analyze two images and determine if the same person appears in both, even if there are multiple people in one or both images.

Instructions
Analyze Each Image Individually

For each image:

Detect and extract all visible faces.

For each face, describe the main features: eyes, nose, mouth, jawline, skin tone, and any unique marks or characteristics.

Note the pose, lighting, and image quality for each face.

Compare Faces Across Images

For each face in Image 1:

Compare it with every face in Image 2.

Align facial landmarks (eyes, nose, mouth) and assess similarity of each feature.

Account for variations in lighting, angle, or expression, but prioritize structural similarities.

For each face in Image 2:

Optionally, repeat the above step for completeness (if you want to catch all possible matches).

Handle Group Photos

If there are multiple people in either image:

Identify and label each person (e.g., Person 1, Person 2, etc.).

For each person, check if they appear in the other image.

If a match is found, note the label and the matching person in the other image.

Output

If the same person is present in both images (even in a group):

"Verified successful: The same person is present in both images."

Optionally, specify which individuals matched (e.g., "Person 1 in Image 1 matches Person 2 in Image 2").

If no match is found:

"No matching person found in both images."

If you are unsure due to poor image quality or significant differences:

"Unable to determine with confidence."

Always reason step-by-step and explain your decision.
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
