import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabase, openAI } from "../supabase.ts";
import { corsHeaders } from "../corsHeaders.ts";
import { Ratelimit } from "../rateLimit.ts";

Deno.serve(async (req) => {

  // Preflight request

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // User input

  const { query } = await req.json();

  try {

    await Ratelimit(100, 86400000, 1);

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
                    5. Valitse yhteystiedoista hankeideaan parhaiten soveltuva edustaja, ja anna hänen yhteystietonsa yrittäjälle, anna yhteystiedot viimeisenä.`                    
        },
        {
          role: 'user', 
          content: query
        }
      ],
      stream: true,
      temperature: 0.8
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of aiResponse) {
          controller.enqueue(encoder.encode(chunk.choices[0]?.delta?.content || ""));
        }
        controller.close();
      }
    })

  return new Response(readableStream, {
    status: 200,
    headers: { 'Content-Type': 'text/plain', ...corsHeaders },
  });

  } catch (error) {
    console.log(error);
    return new Response(JSON.stringify(error), {status: 500});
  }

});
