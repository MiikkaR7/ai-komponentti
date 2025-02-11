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

/*     const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float",

      
    });

    const queryEmbedding = embedding.data[0].embedding;

    const matchThreshold = 0.1;
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

    const fetchContextFromDb = await connection.queryObject(`SELECT (description, metainfo) FROM generalinfo WHERE (metainfo LIKE '%yrittaja%')`);
    const fetchFundingFromDb = await connection.queryObject('SELECT (name, description) FROM funding');
    const fetchContactsFromDb = await connection.queryObject('SELECT (etunimi, sahkopostiosoite, avainsanat) FROM contacts');

    const context = fetchContextFromDb.rows;
    const funding = fetchFundingFromDb.rows;
    const contacts = fetchContactsFromDb.rows;

    const contextString = JSON.stringify(context);
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
      model: "gpt-4o",
      messages: [
        {
          role: 'system', 
          content: `Olet avulias avustaja, jonka tehtävä on auttaa yrittäjiä kehittämään heidän ideoitaan Pohjois-Suomessa antamalla ehdotuksia ja suosituksia. 
          Käytä kontekstina: ${contextString}. Käytä rahoituslähteinä taulua ${fundingString}. Hae yhteystiedot taulusta ${contactsString}. 
          Viestin alussa tervehdi yrittäjää, päätä viestisi ilman terveisiä. Pohdi kontekstin kautta, miten yrittäjän idea kannattaisi toteuttaa, ja soveltuuko se hankkeeksi.
          Älä koskaan anna ehdotuksena jotain, mitä yrittäjä on maininnut viestissään.
          muotoile ehdotukset seuraavalla tavalla ilman luettelomerkkejä vaihtamalla esimerkkiotsikon ehdotukseen sopivaksi:
          Laajenna palveluverkostoasi
          Hyödynnä digitaalista markkinointia
          Hae alueellisia tukia
          jne.
          Mainitse rahoitus ja rahoitusehdotukset vasta viestin lopussa. Viimeisenä valitse yrittäjän ideaan sopivin edustaja yhteystietotaulusta.
          Laita viestisi sisältö content-kenttään, valitsemasi edustajan sähköpostiosoite recipient-kenttään ja esimerkkiaihe hankkeelle subject-kenttään, 
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
