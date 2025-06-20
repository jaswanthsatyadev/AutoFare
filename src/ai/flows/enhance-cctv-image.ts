
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

// This definedPrompt object handles the model, config, and templating for image enhancement.
const enhanceCctvImagePrompt = ai.definePrompt({
  name: 'enhanceCctvImagePrompt',
  model: 'googleai/gemini-2.0-flash-exp', // Explicitly use the image generation model
  input: {schema: EnhanceCctvImageInputSchema},
  output: {schema: EnhanceCctvImageOutputSchema}, // Describes expected text output structure, if any.
  prompt: [ // Array of prompt parts
    {media: {url: '{{{cctvImageDataUri}}}'}}, // Input image, templated
    {
      text: `Enhance the quality of the provided CCTV image. Focus on improving brightness and contrast, reducing noise, and sharpening details to make features more discernible. Return the enhanced image.`,
    },
  ],
  config: {
    responseModalities: ['TEXT', 'IMAGE'], // Expect both text and image in response
  },
});

const enhanceCctvImageFlow = ai.defineFlow(
  {
    name: 'enhanceCctvImageFlow',
    inputSchema: EnhanceCctvImageInputSchema,
    outputSchema: EnhanceCctvImageOutputSchema, // The flow will return data matching this schema.
  },
  async (input: EnhanceCctvImageInput): Promise<EnhanceCctvImageOutput> => {
    // Call the defined prompt. Genkit handles templating and calling ai.generate internally.
    const response = await enhanceCctvImagePrompt(input);

    // The primary output for image generation is in response.media.url
    if (response.media?.url) {
      return { enhancedCctvImageDataUri: response.media.url };
    }
    
    // Fallback or error if media URL is not present
    console.error("Enhanced image media URL is missing in AI response. Response:", JSON.stringify(response));
    if (response.output?.enhancedCctvImageDataUri) {
      // If model somehow put data URI in text output field (less likely for this setup)
      return { enhancedCctvImageDataUri: response.output.enhancedCctvImageDataUri };
    }
    
    throw new Error('Failed to generate enhanced image: No media URL found in AI response.');
  }
);

