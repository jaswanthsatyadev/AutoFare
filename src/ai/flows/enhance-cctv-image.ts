'use server';
/**
 * @fileOverview An AI agent that enhances CCTV image quality using GenAI.
 *
 * - enhanceCctvImage - A function that enhances the CCTV image.
 * - EnhanceCctvImageInput - The input type for the enhanceCctvImage function.
 * - EnhanceCctvImageOutput - The return type for the enhanceCctvImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnhanceCctvImageInputSchema = z.object({
  cctvImageDataUri: z
    .string()
    .describe(
      "The CCTV image data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type EnhanceCctvImageInput = z.infer<typeof EnhanceCctvImageInputSchema>;

const EnhanceCctvImageOutputSchema = z.object({
  enhancedCctvImageDataUri: z
    .string()
    .describe(
      'The enhanced CCTV image data URI in base64 format.'
    ),
});
export type EnhanceCctvImageOutput = z.infer<typeof EnhanceCctvImageOutputSchema>;

export async function enhanceCctvImage(input: EnhanceCctvImageInput): Promise<EnhanceCctvImageOutput> {
  return enhanceCctvImageFlow(input);
}

const enhanceCctvImagePrompt = ai.definePrompt({
  name: 'enhanceCctvImagePrompt',
  input: {schema: EnhanceCctvImageInputSchema},
  output: {schema: EnhanceCctvImageOutputSchema},
  prompt: [
    {media: {url: '{{{cctvImageDataUri}}}'}},
    {
      text: `Enhance the quality of the CCTV image. Improve brightness and contrast, remove noise and blurriness. Return the enhanced image as a data URI in base64 format.`,
    },
  ],
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
  },
});

const enhanceCctvImageFlow = ai.defineFlow(
  {
    name: 'enhanceCctvImageFlow',
    inputSchema: EnhanceCctvImageInputSchema,
    outputSchema: EnhanceCctvImageOutputSchema,
  },
  async input => {
    const {media} = await ai.generate({
      prompt: enhanceCctvImagePrompt.prompt,
      model: 'googleai/gemini-2.0-flash-exp',
      config: enhanceCctvImagePrompt.config,
      input,
    });

    return {enhancedCctvImageDataUri: media.url!};
  }
);
