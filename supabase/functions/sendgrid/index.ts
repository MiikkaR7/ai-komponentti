import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import sgMail from 'npm:@sendgrid/mail';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

sgMail.setApiKey(Deno.env.get('SENDGRID_KEY') ?? "");

Deno.serve(async (req) => {

  try {

    //const { sposti } = await req.json();

    const msg = {
      to: 'miikkariipi22@gmail.com',
      from: 'miikka.riipi@gmail.com',
      subject: 'SendGrid',
      text: 'Esimerkkisähköposti',
  };

    await sgMail.send(msg);

  } catch (error) {

    console.error(error);
    return new Response(String('Internal server error'), { status: 500 });

  }
  
  return new Response(String('Email sent succesfully'), {
    status: 202,
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders
     },
  }
  );
});
