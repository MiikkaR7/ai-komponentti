import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  const { query } = await req.json()

  // openAI-yhteys

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const openai = new OpenAI({
    apiKey: apiKey,
  })

  let reply;

  try {

    // Tietokannasta haetaan yhteystiedot. Tekoäly käsittelee yhteystiedot

    const fetchContactsFromDb = await connection.queryObject('SELECT * FROM contacts');
    const contacts = fetchContactsFromDb.rows;
    const contactsString = JSON.stringify(contacts);

    //Tekoälylle tehtävä pyyntö, jossa määritetään vastaajan rooli

    const chatCompletion = await openai.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: `Olet avulias avustaja. Tehtäväsi on auttaa yrittäjiä kehittämään heidän hankeideoitaan Pohjois-Suomen eli Lapin alueella. 
                    Anna yrittäjälle suosituksia ja parannusehdotuksia hänen ideaansa. Pyri välttämään liian yleisiä suosituksia,
                    kuten tarpeiden kartoitus tai käyttäjäystävällisyyteen liittyvät seikat. Tarkenna ehdotukset yrittäjän idean toimialaan.
                    Anna erityisesti ehdotuksia, jotka ovat hyödyllisiä hankkeen toteuttamisen kannalta.
                    Sisällytä vastaukseen aina rahoitusehdotus, jossa mainitset kaikki mahdolliset rahoituslähteet, jotka ovat kyseiselle hankkeelle relevantteja.
                    Jokaisen antamasi vastauksen lopussa, kutsu käyttäjä ottamaan yhteyttä yhteen Lapin AMK:n edustajaan. 
                    Käytä kutsussa vain edustajan etunimeä ja sähköpostiosoitetta.
                    AMK-edustajien yhteystiedot ovat tässä tietokannan taulussa: ${contactsString}.
                    Vastauksen alussa tervehdi yrittäjää ystävällisesti.
                    Anna vähintään 3 ehdotusta ja rahoitusehdotus erikseen. Anna ehdotukset ilman numerointia tai erikoismerkkejä.`
        },
        { 
          role: 'user', 
          content: query 
        }
      ],
      max_tokens: 1200,
      model: 'gpt-4o',
      stream: false,
    })

    reply = chatCompletion.choices[0].message.content;

  } catch (_error) {
    return new Response(String('Internal server error'), {status: 500});
  }

  return new Response(JSON.stringify({ reply }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
})
