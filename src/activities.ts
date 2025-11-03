import 'dotenv/config';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

export async function greet(name: string): Promise<string> {
  if (Math.random() < 0.5) throw new Error('Not implemented yet. Fill in the implementation to call OpenAI API.');

  const result = await client.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [
      { role: 'system', content: 'You are a poet.' },
      { role: 'user', content: `Write a poem about ${name}.` },
    ],
  });

  return result.choices[0].message.content ?? 'Unable to generate poem.';
}
