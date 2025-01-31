import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'
import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit@latest";
import { Redis } from "https://esm.sh/@upstash/redis@1.34.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Tietokantayhteys
const databaseUrl = Deno.env.get('SUPABASE_DB_URL');
const pool = new postgres.Pool(databaseUrl, 100, true);
const connection = await pool.connect();

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Käyttäjän syöte

  const { query } = await req.json();

  // openAI-yhteys

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const openai = new OpenAI({
    apiKey: apiKey,
  });

  try {

    //Rate limit

    const redis = new Redis({
      url: Deno.env.get('UPSTASH_REDIS_REST_URL')!,
      token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!,
    });
    
    const rateLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '42300 s'),
      analytics: true,
    });
    
    const identifier = 'openAI-limit';
    const { success } = await rateLimit.limit(identifier);
    
    if (!success) {
      throw new Error('Limit exceeded');
    }

    // Tietokannasta haetaan kontekstia ja rahoituslähteet.

    const fetchContextFromDb = await connection.queryObject('SELECT (name, description) FROM generalinfo');
    const fetchFundingFromDb = await connection.queryObject('SELECT (name, description) FROM funding');

    const context = fetchContextFromDb.rows;
    const funding = fetchFundingFromDb.rows;

    const contextString = JSON.stringify(context);
    const fundingString = JSON.stringify(funding);

    //Tekoälylle tehtävä pyyntö, jossa määritetään vastaajan rooli

    let reply;

    const ExpertResponse = await openai.chat.completions.create({
      messages: [
        {
          role: 'system', 
          content: `Rajoita vastauksesi noin 1200 merkkiin. Olet avulias avustaja. Tehtäväsi on auttaa Lapin AMK:n hankevalmistelijoita.
                    Anna hankevalmistelijalle näkökulmia ja toteutustapoja vastaanotettuun ideaan. Pohdi, millainen toteutustapa tai lähestymistapa soveltuisi yrittäjän ehdotukselle.
                    Pohdi erityisesti, miten hanke voitaisiin toteuttaa osana AMK:n hanketoimintaa, ja mitä AMK:n resursseja voidaan käyttää. 
                    Käytä tätä taulukkoa kontekstina: ${contextString}.
                    Ehdota hankevalmistelijalle myös rahoituslähteitä hankeidealle. Rahoituslähteet ovat tässä taulukossa: ${fundingString}.`
        },
        {
          role: 'user', 
          content: query 
        }
      ],
      model: 'gpt-4o',
      stream: false,
    });

    reply = ExpertResponse.choices[0].message.content;

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (error) {
    console.log(error);
    return new Response(JSON.stringify({error: error.message}), {status: 500});
  }

});
