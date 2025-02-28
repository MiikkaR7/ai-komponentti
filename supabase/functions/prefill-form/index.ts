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
