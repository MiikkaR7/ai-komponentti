import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabase, openAI } from "../supabase.ts";
import { corsHeaders } from "../corsHeaders.ts";

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // User input

  const { query } = await req.json();

  try {

    // Rate limit using database table ratelimit_hankeai
    // Get table data

    const { data: fetchData, error: fetchError } = await supabase.from('ratelimit_hankeai').select('reset_at, requests, resets').eq('id', 2)

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
      .eq('id', 2)

      const { error: requestsError } = await supabase
      .from('ratelimit_hankeai')
      .update({requests: 1})
      .eq('id', 2)

      const { error: resetError } = await supabase
      .from('ratelimit_hankeai')
      .update({resets: resets + 1})
      .eq('id', 2)

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
      .eq('id', 2)

      if (error) {
        throw new Error(error.message);
      }

    }

    // Get context, funding sources and contacts from db
    // Create JSON object with openAI response(content), AMK-expert(recipient), example subject(subject) and summarized email(message)

    const {data: contextDbTable, error: contextError} = await supabase.from('generalinfo_json').select('data');
    const {data: fundingDbTable, error: fundingError} = await supabase.from('funding_json').select('data');

    if (contextError) {
      throw new Error(contextError.message);
    }
    if (fundingError) {
      throw new Error(fundingError.message);
    }

    const contextString = JSON.stringify(contextDbTable);
    const fundingString = JSON.stringify(fundingDbTable);

    // openAI request

    const ExpertResponse = await openAI.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: 'system', 
          content: `Rajoita vastauksesi noin 15 virkkeeseen. Olet avustaja, jonka tehtävä on auttaa Lapin AMK:n hankevalmistelijoita, vastaanottamalla yrittäjän hankeidea ja laatimalla siitä hankevalmistelijalle viesti.
                    Käytä kontekstina ${contextString}. Noudata alla olevia ohjeita:
                    1. Muotoile ehdotukset ja rahoitusehdotukset ilman luettelomerkkejä.
                    2. Tee johtopäätös siitä, soveltuuko idea paremmin opiskelijayhteistyöksi vai hankkeeksi käyttämällä kontekstia.
                    3. Jos idea soveltuu hankkeeksi, päätä onko hanke tutkimus- vai aluekehityspainotteinen.
                    4. Anna hankevalmistelijalle näkökulmia ja toteutustapoja vastaanotettuun ideaan.
                    5. Ehdota hankevalmistelijalle myös rahoituslähteitä hankeidealle, rahoituslähteet ovat tässä taulukossa: ${fundingString}.`
        },
        {
          role: 'user', 
          content: query
        }
      ],
      stream: false,
      temperature: 0
    });

    const reply = ExpertResponse.choices[0].message.content;

    return new Response(JSON.stringify({reply}), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.log(error);
    return new Response(JSON.stringify(error), {status: 500});
  }

});
