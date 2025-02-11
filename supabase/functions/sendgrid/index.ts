import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import sgMail from 'npm:@sendgrid/mail';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

sgMail.setApiKey(Deno.env.get('SENDGRID_KEY')!);
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  //Have to interact with preflight request before parsing request body

  const origin = req.headers.get('Origin');

  const message = await req.json();

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase
    .from('emails')
    .insert({ sender: message.sender, recipient: message.recipient, subject: message.subject, message: message.message });

    if (error) {
      throw new Error(JSON.stringify(error.message));
    }


  //Email functionality (TODO: Verified sender address)

  /* try {

    const msg = {
      from: Deno.env.get('SENDGRID_SENDER') ?? '',
      replyTo: message.sender,
      subject: message.subject,
      to: message.recipient,
      text: message.message,
  };

    response = await sgMail.send(msg);

  } catch (error) {

    console.error(error);
    return new Response(String('Internal server error'), { status: 500 });

  } */
  
  return new Response((JSON.stringify(message)), {
    status: 202,
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders
     },
  }
  );
});
