import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabase, openAI } from "../supabase.ts";
import { corsHeaders } from "../corsHeaders.ts";
import { Ratelimit } from "../rateLimit.ts";

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // User input

  const { query } = await req.json();

  try {

    await Ratelimit(100, 86400000, 2);

    // Get context, funding sources and contacts from db
    // Create JSON object with openAI response(content), AMK-expert(recipient), example subject(subject) and summarized email(message)

    const {data: contextDbTable, error: contextError} = await supabase.from('generalinfo').select('name, description');
    const {data: fundingDbTable, error: fundingError} = await supabase.from('funding').select('name, description');

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
      model: "gpt-4o-mini",
      messages: [
        {
          role: 'system', 
          content: `Rajoita vastauksesi noin 15 virkkeeseen. Olet avustaja, joka vastaanottaa hankeidean ja käsittelee sen hankevalmistelijalle.
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
