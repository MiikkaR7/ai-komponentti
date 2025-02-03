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

  let reply;

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

    // Tietokannasta haetaan kontekstia, rahoituslähteet ja yhteystiedot.

    const fetchContextFromDb = await connection.queryObject(`SELECT name, description, metainfo FROM generalinfo WHERE (metainfo LIKE '%yrittaja%')`);
    const fetchFundingFromDb = await connection.queryObject('SELECT (name, description) FROM funding');
    const fetchContactsFromDb = await connection.queryObject('SELECT (etunimi, sahkopostiosoite) FROM contacts');

    const context = fetchContextFromDb.rows;
    const funding = fetchFundingFromDb.rows;
    const contacts = fetchContactsFromDb.rows;

    const contextString = JSON.stringify(context);
    const fundingString = JSON.stringify(funding);
    const contactsString = JSON.stringify(contacts);

    //Tekoälylle tehtävä pyyntö, jossa määritetään vastaajan rooli

    const chatCompletionStream = await openai.chat.completions.create({
      messages: [
        {
          role: 'system', 
          content: `Olet avulias avustaja, jonka tehtävä on auttaa yrittäjiä kehittämään heidän hankeideoitaan Pohjois-Suomessa. Noudata alla olevia ohjeita:
                    1. Rajoita vastauksesi noin 1200 merkkiin.
                    2. Vastauksesi alussa tervehdi yrittäjää.
                    3. Anna yrittäjälle suosituksia ja parannusehdotuksia hänen ideaansa, käytä tätä taulua kontekstina: ${contextString}.
                    4. Sisällytä vastaukseen aina yrittäjän hankeideaan soveltuvia rahoituslähteitä, rahoituslähteet ovat tässä taulussa: ${fundingString}.
                    5. Ehdotusten lopuksi anna 3 hyvin lyhyttä esimerkkiaihetta hankkeelle.
                    6. Vastauksen lopussa kutsu yrittäjä ottamaan yhteyttä ideaan sopiviin edustajiin taulusta ${contactsString}, anna heidän sähköpostiosoitteet ja nimet.`                   
        },
        {
          role: 'user', 
          content: query 
        }
      ],
      model: 'gpt-4o',
      stream: true,
      temperature: 0.1
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of chatCompletionStream) {
          controller.enqueue(encoder.encode(chunk.choices[0]?.delta?.content || ""));
        }
        controller.close();
      }
    })

    return new Response(readableStream, {
      status: 200,
      headers: { 'Content-Type': 'text/plain', ...corsHeaders },
    })

    //reply = chatCompletionStream.choices[0].message.content;

  } catch (error) {
    console.log(error);
    return new Response(JSON.stringify({error: error.message}), {status: 500});
  }

});
