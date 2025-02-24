import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabase, openAI } from "../supabase.ts";
import { corsHeaders } from "../corsHeaders.ts";

Deno.serve(async (req) => {

  // Preflight request

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // User input

  const { query } = await req.json();

  try {

    // Rate limit using database table ratelimit_hankeai
    // Get table data

    const { data: fetchData, error: fetchError } = await supabase.from('ratelimit_hankeai').select('reset_at, requests, resets');

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
      .eq('id', 1)

      const { error: requestsError } = await supabase
      .from('ratelimit_hankeai')
      .update({requests: 1})
      .eq('id', 1)

      const { error: resetError } = await supabase
      .from('ratelimit_hankeai')
      .update({resets: resets + 1})
      .eq('id', 1)

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
      .eq('id', 1)

      if (error) {
        throw new Error(error.message);
      }

    }

    // Get context, funding sources and contacts from db
    // Create JSON object with openAI response(content), AMK-expert(recipient), example subject(subject) and summarized email(message)

    const {data: contextDbTable, error: contextError} = await supabase.from('generalinfo_json').select('data');
    const {data: fundingDbTable, error: fundingError} = await supabase.from('funding_json').select('data');
    const {data: contactsDbTable, error: contactsError} = await supabase.from('contacts').select('etunimi, sahkopostiosoite, avainsanat');

    if (contextError) {
      throw new Error(contextError.message);
    }
    if (fundingError) {
      throw new Error(fundingError.message);
    }
    if (contactsError) {
      throw new Error(contactsError.message);
    }

    const contextString = JSON.stringify(contextDbTable);
    const fundingString = JSON.stringify(fundingDbTable);
    const contactsString = JSON.stringify(contactsDbTable);

    // openAI request

    const aiResponse = await openAI.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: 'system', 
          content: 
                    `Rajoita vastauksesi noin 15 virkkeeseen. Olet avulias avustaja, jonka tehtävä on auttaa yrittäjiä kehittämään heidän hankeideoitaan.
                    Käytä kontekstina ${contextString}. Rahoituslähteet ovat taulukossa: ${fundingString}. Edustajien yhteystiedot ovat taulussa: ${contactsString}.
                    Päättele kontekstin avulla, soveltuuko idea hankkeeksi ja miten se voitaisiin toteuttaa hyödyntämällä AMK:n resursseja. 
                    Noudata viestissäsi alla olevia ohjeita:
                    1. Viestin alussa tervehdi yrittäjää, ja lopuksi anna terveiset nimimerkillä Lapin AMK.
                    2. Muotoile ehdotukset ja rahoitusehdotukset ilman luettelomerkkejä.
                    3. Anna yrittäjälle käytännön ehdotuksia vastaanotetun idean toteuttamiseen, älä ikinä anna ehdotusta, jonka yrittäjä on jo maininnut viestissään.
                    4. Ehdota myös vähintään kolmea rahoituslähdettä hankeidealle käyttäen rahoituslähdetaulua, anna rahoitusehdotukset käytännön ehdotusten jälkeen.
                    5. Valitse yhteystiedoista hankeideaan parhaiten soveltuva edustaja, ja anna hänen yhteystietonsa yrittäjälle, anna yhteystiedot viimeisenä.
                    ---
                    Luo JSON-objekti laittamalla viestisi sisältö content-kenttään, valitsemasi edustajan sähköpostiosoite recipient-kenttään ja esimerkkiaihe hankkeelle subject-kenttään. 
                    Tiivistä antamasi vastaus sähköpostiin sopivaksi message-kenttään, kirjoita sähköpostiviesti niin, että yrittäjä olisi kirjoittanut sen.`
                    
                      
        },
        {
          role: 'user', 
          content: query
        }
      ],
      response_format: { type: "json_object" },
      stream: false,
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
