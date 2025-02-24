import { createClient } from 'npm:@supabase/supabase-js';
import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'

//Create supabase connection using service key
//Service key is safe to use since it is not exposed to browser/user, only used inside Edge functions

export const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// openAI connection

const apiKey = Deno.env.get('OPENAI_API_KEY')!;

export const openAI = new OpenAI({
  apiKey: apiKey,
});