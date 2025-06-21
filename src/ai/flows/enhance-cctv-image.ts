
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
    .refine(val => val.startsWith('data:image/'), {
      message: "CCTV image must be a valid image data URI starting with 'data:image/'."
    })
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
  // Validate input explicitly here before calling the flow,
  // though defineFlow also validates against its inputSchema.
  const validatedInput = EnhanceCctvImageInputSchema.parse(input);
  return enhanceCctvImageFlow(validatedInput);
}

const enhanceCctvImageFlow = ai.defineFlow(
  {
    name: 'enhanceCctvImageFlow',
    inputSchema: EnhanceCctvImageInputSchema,
    outputSchema: EnhanceCctvImageOutputSchema,
  },
  async (input: EnhanceCctvImageInput): Promise<EnhanceCctvImageOutput> => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: [
        {media: {url: input.cctvImageDataUri}}, // Pass the data URI directly
        {
          text: `Enhance the quality of the provided CCTV image. Focus on improving brightness and contrast, reducing noise, and sharpening details to make features more discernible. Return the enhanced image.`,
        },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (media?.url) {
      return { enhancedCctvImageDataUri: media.url };
    }
    
    console.error("Enhanced image media URL is missing in AI response. Full response object might give clues if generate call succeeded but returned unexpected structure.");
    throw new Error('Failed to generate enhanced image: No media URL found in AI response.');
  }
);

