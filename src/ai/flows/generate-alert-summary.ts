
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
  summary: z.string().describe('A short summary of the verification failure.'),
});
export type GenerateAlertSummaryOutput = z.infer<typeof GenerateAlertSummaryOutputSchema>;

export async function generateAlertSummary(input: GenerateAlertSummaryInput): Promise<GenerateAlertSummaryOutput> {
  return generateAlertSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAlertSummaryPrompt',
  input: {schema: GenerateAlertSummaryInputSchema},
  output: {schema: GenerateAlertSummaryOutputSchema},
  prompt: `You are a security expert analyzing a face verification failure. Based on the user's selfie and the CCTV image, generate a short summary of why the verification may have failed. Focus on significant differences that would make the individuals appear to be *different people*, even if overall facial structure seems somewhat similar. Ignore minor variations in facial expressions, lighting conditions, or clothing. The goal is to identify if the individuals are likely different, not to nitpick minor discrepancies if they appear to be the same person.

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
    const {output} = await prompt(input);
    return output!;
  }
);

