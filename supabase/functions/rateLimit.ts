import { supabase } from "./supabase.ts";

  export const Ratelimit = async (limit: number, threshold: number, id: number) => {
  
  // Rate limit using database table ratelimit_hankeai
  // Get table data

  const { data: fetchData, error: fetchError } = await supabase.from('ratelimit_hankeai').select('reset_at, requests, resets').eq('id', id);

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  
  // Set rate limit and reset threshold
  const rateLimit = limit;
  const resetTreshold = threshold;

  // Get current amount of requests, resets and last reset time from table ratelimit_hankeai
  const requests = fetchData![0].requests;
  const resets = fetchData![0].resets;
  const resetAt = fetchData![0].reset_at;
  // Convert reset time timestamptz to Date and get current time
  const resetAtDate = new Date(resetAt);
  const currentTime = Date.now();

  // Calculate time difference between last reset than now, reset the time if 24 hours have passed
  const timeDifference = currentTime - resetAtDate.getTime();

  // Rate limit logic, first check if more than 24 hours have passed since last reset, then enforce rate limit, after that allow request
  if (timeDifference > resetTreshold) {

    console.log("Rate limit expired, resetting")
    const { error: timeError } = await supabase
    .from('ratelimit_hankeai')
    .update({reset_at: new Date().toISOString().split('.')[0] + "+00:00"})
    .eq('id', id)

    const { error: requestsError } = await supabase
    .from('ratelimit_hankeai')
    .update({requests: 1})
    .eq('id', id)

    const { error: resetError } = await supabase
    .from('ratelimit_hankeai')
    .update({resets: resets + 1})
    .eq('id', id)

    if (timeError || requestsError || resetError) {
      throw new Error("Error resetting rate limit");
    }

  } else if (requests >= rateLimit) {

    // Rate limit is 100 requests in 24 hours
    throw new Error("Rate limit exceeded");

  } else {

    const { error } = await supabase
    .from('ratelimit_hankeai')
    .update({ requests: requests + 1})
    .eq('id', id)

    if (error) {
      throw new Error(error.message);
    }

  }

}