import { proxyActivities } from '@temporalio/workflow';
// Only import the activity types
import type * as activities from './activities';

const { reverse } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

/** A workflow that simply calls an activity */
export async function example(address: string) {
  //   const marketData = await getHemnetData(address);

  //   const propertyDetails = await getPropertyDetails();

  //   const technicalData = await getTechnicalData();

  //   const { confidence, maxValue, minValue } = await calculateValue({
  //     marketData,
  //     propertyDetails,
  //     technicalData,
  //   });

  const rev = reverse(address);

  return rev;
}
