import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabase, openAI } from "../supabase.ts";
import { corsHeaders } from "../corsHeaders.ts";

Deno.serve(async (req) => {

  // Preflight request

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Text input

  const query = await req.json();

  try {

    // Rate limit using database table ratelimit_hankeai
        // Get table data
    
        const { data: fetchData, error: fetchError } = await supabase.from('ratelimit_hankeai').select('reset_at, requests, resets').eq('id', 3)
    
        if (fetchError) {
          throw new Error(fetchError.message);
        }
        
        // Set rate limit and reset threshold
        const rateLimit = 100;
        const resetTreshold = 86400000;
    
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
          .eq('id', 3)
    
          const { error: requestsError } = await supabase
          .from('ratelimit_hankeai')
          .update({requests: 1})
          .eq('id', 3)
    
          const { error: resetError } = await supabase
          .from('ratelimit_hankeai')
          .update({resets: resets + 1})
          .eq('id', 3)
    
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
          .eq('id', 3)
    
          if (error) {
            throw new Error(error.message);
          }
    
        }
  
    // openAI request

    const aiResponse = await openAI.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: 'system', 
          content: 
                    `Olet avustaja, jonka tehtävä on luoda JSON-objekti tekstistä, joka sisältää hankeidean.
                    Luo JSON-objekti, jossa kentässä subject on lyhyt esimerkkiaihe hankeidealle, 
                    kentässä recipient tekstissä mainitun yhteyshenkilön sähköpostiosoite,
                    ja kentässä message tiivistetty viesti. Kirjoita message niin kuin yrittäjä olisi kirjoittanut sen.`
                    
                      
        },
        {
          role: 'user', 
          content: query
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0
    });

  const reply = aiResponse.choices[0].message.content;

  return new Response(reply, {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

  } catch (error) {
    console.log(error);
    return new Response(JSON.stringify(error), {status: 500});
  }

});
