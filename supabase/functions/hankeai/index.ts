import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "86400 s"),
  analytics: true,
  /**
   * Optional prefix for the keys used in redis. This is useful if you want to share a redis
   * instance with other applications and want to avoid key collisions. The default prefix is
   * "@upstash/ratelimit"
   */
  prefix: "@upstash/ratelimit",
});

// Use a constant string to limit all requests with a single ratelimit
// Or use a userID, apiKey or ip address for individual limits.
const identifier = "api";
const { success } = await ratelimit.limit(identifier);



(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Tietokantayhteys
const databaseUrl = Deno.env.get('SUPABASE_DB_URL');
const pool = new postgres.Pool(databaseUrl, 10, true);
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
                    Vastauksen alussa tervehdi yrittäjää ystävällisesti.
                    Valitse sopivat edustajat vertaamalla yrittäjän antamaa hankeideaa edustajien avainsanat-sarakkeeseen.
                    Kutsu yrittäjä ottamaan yhteyttä niihin edustajiin, joiden kuvaus ja avainsanat liittyvät yrittäjän antamaan hankeideaan.
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

  } catch (_error) {
    return new Response(String('Internal server error'), {status: 500});
  }

  return new Response(JSON.stringify({ reply }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
});
