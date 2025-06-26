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

    const {data: contextDbTable, error: contextError} = await supabase.from('generalinfo').select('name, description');
    const {data: fundingDbTable, error: fundingError} = await supabase.from('funding').select('name, description');
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
      model: "gpt-4o-mini",
      messages: [
        {
          role: 'system', 
          content: `Rajoita vastauksesi noin 15 virkkeeseen. Olet avustaja, joka vastaanottaa hankeidean ja käsittelee sen yrittäjälle.
                    Käytä kontekstina ${contextString}. Noudata alla olevia ohjeita:
                    1. Muotoile ehdotukset ja rahoitusehdotukset ilman luettelomerkkejä.
                    2. Tee johtopäätös siitä, soveltuuko idea paremmin opiskelijayhteistyöksi vai hankkeeksi käyttämällä kontekstia.
                    3. Jos idea soveltuu hankkeeksi, päätä onko hanke tutkimus- vai aluekehityspainotteinen.
                    4. Anna yrittäjälle näkökulmia ja toteutustapoja vastaanotettuun ideaan.
                    5. Ehdota yrittäjälle myös rahoituslähteitä hankeidealle, rahoituslähteet ovat tässä taulukossa: ${fundingString}.
                    6. Valitse yhteystiedoista avainsanat-sarakkeen perusteella yrittäjän ideaan parhaiten soveltuva edustaja, ja anna hänen yhteystietonsa. Yhteystiedot ovat taulukossa: ${contactsString}.`         
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
