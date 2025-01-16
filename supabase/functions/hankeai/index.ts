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

// Initialize DB connection
const databaseUrl = Deno.env.get('SUPABASE_DB_URL');
const pool = new postgres.Pool(databaseUrl, 10, true);
const connection = await pool.connect();

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  //Get query from user

  const { query } = await req.json()

  //Initialize openAI connection

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const openai = new OpenAI({
    apiKey: apiKey,
  })

  let reply;

  try {

    const fetchContactsFromDb = await connection.queryObject('SELECT * FROM contacts');
    const contacts = fetchContactsFromDb.rows;
    const contactsString = JSON.stringify(contacts);

    const chatCompletion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: `You are a helpful assistant.  At the end of every response, 
                                    recommend the user to contact the provided contacts email address provided in this string of data: ${contactsString}`},  
        { role: 'user', content: query }],
      model: 'gpt-4o',
      stream: false,
    })

    reply = chatCompletion.choices[0].message.content;

  } catch (_error) {
    return new Response(String('Internal server error'), {status: 500});
  }

  return new Response(reply, {
    status: 200,
    headers: { 'Content-Type': 'text/plain', ...corsHeaders },
  })
})
