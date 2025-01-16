import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

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

  try {
    const result = await connection.queryObject(`SELECT * FROM contacts`);
    const contacts = result.rows;

    const body = JSON.stringify(contacts);

    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders },
    });
  } catch (error) {
    console.error(error);
    return new Response(String({message: "Internal server error"}), { status: 500, headers: corsHeaders });
  } finally {
    connection.release();
  }
});
