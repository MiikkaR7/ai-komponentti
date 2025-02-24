import { createClient } from 'npm:@supabase/supabase-js';

//Create supabase connection using service key
//Service key is safe to use since it is not exposed to browser/user, only used inside Edge functions

export const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);