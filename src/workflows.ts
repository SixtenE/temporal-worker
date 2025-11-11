import { proxyActivities } from '@temporalio/workflow';
// Only import the activity types
import type * as activities from './activities';

const { askLLM, scrape } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

/** A workflow that simply calls an activity */
export async function example(text: string) {
  const scrapedItems = await scrape(text);
  const llmResponse = await askLLM(text, scrapedItems);
  return llmResponse;
}
