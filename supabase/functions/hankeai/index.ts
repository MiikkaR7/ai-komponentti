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

    // Tietokannasta haetaan yhteystiedot. Tekoäly käsittelee yhteystiedot

    const fetchContactsFromDb = await connection.queryObject('SELECT (etunimi, sahkopostiosoite, avainsanat) FROM contacts');
    const contacts = fetchContactsFromDb.rows;
    const contactsString = JSON.stringify(contacts);

    //Tekoälylle tehtävä pyyntö, jossa määritetään vastaajan rooli

    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system', 
          content: `Rajoita vastaus noin tuhanteen merkkiin.
                    Olet avulias avustaja. Tehtäväsi on auttaa yrittäjiä kehittämään heidän hankeideoitaan Pohjois-Suomen eli Lapin alueella. 
                    Anna yrittäjälle suosituksia ja parannusehdotuksia hänen ideaansa. Pyri välttämään liian yleisiä suosituksia,
                    kuten tarpeiden kartoitus tai käyttäjäystävällisyyteen liittyvät seikat. Tarkenna ehdotukset yrittäjän idean toimialaan.
                    Sisällytä vastaukseen aina rahoitusehdotus, jossa mainitset rahoituslähteitä, jotka ovat kyseiselle hankkeelle relevantteja.
                    Anna vähintään 3 ehdotusta ja rahoitusehdotus erikseen. Anna ehdotukset ilman numerointia tai erikoismerkkejä.
                    Ehdotusten lopuksi anna 3 hyvin lyhyttä esimerkkiaihetta hankkeelle.
                    Vastauksen alussa tervehdi yrittäjää ystävällisesti.
                    Valitse sopivat edustajat vertaamalla yrittäjän antamaa hankeideaa edustajien avainsanat-sarakkeeseen.
                    Kutsu yrittäjä ottamaan yhteyttä sähköpostin kautta niihin edustajiin, joiden kuvaus ja avainsanat liittyvät yrittäjän antamaan hankeideaan.
                    AMK-edustajien yhteystiedot ja kuvaus ovat tässä tietokannan taulussa: ${contactsString}.`
        },
        {
          role: 'user', 
          content: query 
        }
      ],
      model: 'gpt-4o',
      stream: false,
    });

    reply = chatCompletion.choices[0].message.content;

  } catch (error) {
    console.log(error);
    return new Response(JSON.stringify({error: error.message}), {status: 500});
  }

  return new Response(JSON.stringify({ reply }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
});
