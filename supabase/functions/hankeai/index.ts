import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'
import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit@latest";
import { Redis } from "https://esm.sh/@upstash/redis@1.34.3";
import { zodResponseFormat } from 'https://deno.land/x/openai@v4.55.1/helpers/zod.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import z from "npm:zod@^3.24.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, api_key, content-type',
};


(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Tietokantayhteys
const databaseUrl = Deno.env.get('SUPABASE_DB_URL');
const pool = new postgres.Pool(databaseUrl, 100, true);
const connection = await pool.connect();

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

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

    //Query embedding

    /* const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float",

      
    });

    const queryEmbedding = embedding.data[0].embedding;

    const matchThreshold = 0.33;
    const matchCount = 5;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data , error } = await supabase
      .rpc('match_funding', {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount
      });

    if (error) {
      throw new Error('Error finding matching embeddings from Supabase: ' + error.message);
    }

    console.log("Match data: " + JSON.stringify(data, null, 2)); */


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

    //const fetchContextFromDb = await connection.queryObject(`SELECT name, description, metainfo FROM generalinfo WHERE (metainfo LIKE '%yrittaja%')`);
    const fetchFundingFromDb = await connection.queryObject('SELECT (name, description) FROM funding');
    const fetchContactsFromDb = await connection.queryObject('SELECT (etunimi, sahkopostiosoite, avainsanat) FROM contacts');

    //const context = fetchContextFromDb.rows;
    const funding = fetchFundingFromDb.rows;
    const contacts = fetchContactsFromDb.rows;

    //const contextString = JSON.stringify(context);
    const fundingString = JSON.stringify(funding);
    const contactsString = JSON.stringify(contacts);

    //Tekoälylle tehtävä pyyntö

    const jsonReplyFormat = z.object({
      content: z.string(),
      subject: z.string(),
      recipient: z.string(),
      message: z.string()
    });

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: 'system', 
          content: `Olet avulias avustaja, jonka tehtävä on auttaa yrittäjiä kehittämään heidän hankeideoitaan Pohjois-Suomessa. Noudata alla olevia ohjeita:
                    1. Vastauksesi alussa tervehdi yrittäjää.
                    2. Anna yrittäjälle useita suosituksia ja parannusehdotuksia hänen ideansa toteuttamiseen, 
                    muotoile ehdotukset seuraavalla tavalla ilman luettelomerkkejä vaihtamalla esimerkkiotsikon ehdotukseen sopivaksi:
                    Laajenna palveluverkostoasi
                    Hyödynnä digitaalista markkinointia
                    Hae alueellisia tukia
                    jne.
                    3. Sisällytä vastaukseen aina yrittäjän hankeideaan soveltuvia rahoituslähteitä, rahoituslähteet ovat tässä taulussa: ${fundingString}.
                    4. Ehdotusten lopuksi anna  hyvin lyhyt esimerkkiaihe hankkeelle.
                    5. Vertaa yrittäjän antamaa hankeideaa taulun ${contactsString} edustajien avainsanat-sarakkeeseen, ja anna heidän yhteystiedot yrittäjälle viestin lopussa.
                    6. Lopeta viestisi, kun olet antanut valitsemasi edustajan yhteystiedot.
                    7. Laita viestin sisältö content-kenttään, edustajan sähköpostiosoite recipient-kenttään ja hankkeen esimerkkiaihe subject-kenttään, 
                    ja tiivistä antamasi vastaus sähköpostiin sopivaksi message-kenttään, kirjoita sähköpostiviesti minä-muodossa.`         
        },
        {
          role: 'user', 
          content: query
        }
      ],
      response_format: zodResponseFormat(jsonReplyFormat, "hankeidea"),
      stream: false,
      temperature: 0.3
    });

  const reply = aiResponse.choices[0].message.content;

  return new Response(reply, {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

  } catch (error: any) {
    console.log(error);
    return new Response(JSON.stringify({error: error.message}), {status: 500});
  }

});
