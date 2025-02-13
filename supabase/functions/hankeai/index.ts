import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'
import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit@latest";
import { Redis } from "https://esm.sh/@upstash/redis@1.34.3";
import { zodResponseFormat } from 'https://deno.land/x/openai@v4.55.1/helpers/zod.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import z from "npm:zod@^3.24.1";
import { time } from "node:console";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, api_key, content-type',
};


(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Tietokantayhteys
const databaseUrl = Deno.env.get('SUPABASE_DB_URL')!;
const pool = new postgres.Pool(databaseUrl, 100, true);
const connection = await pool.connect();

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const matchThreshold = 0;
    const matchCount = 3;
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

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: fetchData, error: fetchError } = await supabase.from('ratelimit_hankeai').select(`reset_at, requests, resets`);

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    //Get current amount of requests, resets and last reset time from db
    const requests = fetchData![0].requests;
    const resets = fetchData![0].resets;


    //Rate limit is 100 requests in 24 hours
    if (requests > 100) {
      throw new Error("Rate limit exceeded");
    }

    const resetAt = fetchData![0].reset_at;
    const resetAtDate = new Date(resetAt);
    const currentTime = Date.now();



    //Calculate time difference between last reset than now, reset the time if 24 hours have passed
    const timeDifference = currentTime - resetAtDate.getTime();

    if (timeDifference > 86400000) {
      console.log("Rate limit expired, resetting")
      const { data, error } = await supabase
      .from('ratelimit_hankeai')
      .update({ requests: 0, reset_at: new Date().toISOString().split('.')[0] + "+00:00", resets: resets + 1})
      .eq('id', 1)

      if (error) {
        throw new Error(error.message);
      }

    } else {
      const { data, error } = await supabase
      .from('ratelimit_hankeai')
      .update({ requests: requests + 1})
      .eq('id', 1)

      if (error) {
        throw new Error(error.message);
      }

    }

    /* const redis = new Redis({
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
    } */

    // Tietokannasta haetaan kontekstia, rahoituslähteet ja yhteystiedot.

    const fetchContextFromDb = await connection.queryObject('SELECT data FROM generalinfo_json');
    const fetchFundingFromDb = await connection.queryObject('SELECT data FROM funding_json');
    const fetchContactsFromDb = await connection.queryObject('SELECT etunimi, sahkopostiosoite, avainsanat FROM contacts');

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
          content: 
          `Rajoita vastauksesi noin 15 virkkeeseen. Olet avulias avustaja, jonka tehtävä on auttaa yrittäjiä kehittämään heidän hankeideoitaan.
                    Käytä kontekstina ${contextString}. Rahoituslähteet ovat taulukossa: ${fundingString}. Edustajien yhteystiedot ovat taulussa: ${contactsString}.
                    Päättele kontekstin avulla, soveltuuko idea hankkeeksi ja miten se voitaisiin toteuttaa hyödyntämällä AMK:n resursseja. 
                    Noudata viestissäsi alla olevia ohjeita:
                    1. Viestin alussa tervehdi yrittäjää, ja lopuksi anna terveiset nimimerkillä Lapin AMK.
                    2. Muotoile ehdotukset ja rahoituslähteet seuraavalla tavalla ilman luettelomerkkejä vaihtamalla esimerkkiotsikon ehdotukseen sopivaksi tai rahoituslähteen nimeksi:
                        Laajenna palveluverkostoasi
                        Hyödynnä digitaalista markkinointia
                        Hae alueellisia tukia
                        jne.
                    3. Anna yrittäjälle käytännön ehdotuksia vastaanotetun idean toteuttamiseen, älä ikinä anna ehdotusta, jonka yrittäjä on jo maininnut viestissään.
                    4. Ehdota myös vähintään kolmea rahoituslähdettä hankeidealle käyttäen rahoituslähdetaulua, anna rahoitusehdotukset aina viimeisenä.
                    5. Valitse yhteystiedoista hankeideaan parhaiten soveltuva edustaja, ja anna hänen nimi ja sähköpostiosoite yrittäjälle.
                    ---
                    Laita viestisi sisältö content-kenttään, valitsemasi edustajan sähköpostiosoite recipient-kenttään ja esimerkkiaihe hankkeelle subject-kenttään. 
                    Tiivistä antamasi vastaus sähköpostiin sopivaksi message-kenttään, kirjoita sähköpostiviesti niin, että yrittäjä olisi kirjoittanut sen.`
                    
                      
        },
        {
          role: 'user', 
          content: query
        }
      ],
      response_format: zodResponseFormat(jsonReplyFormat, "hankeidea"),
      stream: false,
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
