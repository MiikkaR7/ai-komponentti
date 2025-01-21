import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import sgMail from 'npm:@sendgrid/mail';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

sgMail.setApiKey(Deno.env.get('SENDGRID_KEY') ?? "");

let response;

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  //StackOverflow fix to enable accessing req object

  const origin = req.headers.get('Origin');
  console.log('origin is :', origin);

  const message = await req.json();

  try {

    const msg = {
      from: Deno.env.get('SENDGRID_SENDER') ?? '',
      replyTo: message.message[1],
      subject: message.message[2],
      to: message.message[3],
      text: message.message[4],
  };

    response = await sgMail.send(msg);

  } catch (error) {

    console.error(error);
    return new Response(String('Internal server error'), { status: 500 });

  }
  
  return new Response((JSON.stringify(response)), {
    status: 202,
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders
     },
  }
  );
});
