import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import sgMail from 'npm:@sendgrid/mail';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

sgMail.setApiKey(Deno.env.get('SENDGRID_KEY')!);
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const apiKey = Deno.env.get('OPENAI_API_KEY');
  const openai = new OpenAI({
    apiKey: apiKey,
  });

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {

    const message = await req.json();

    //Use AI to detect misuse/spam/junk messages

    const spamCheck = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Olet roskapostia estävä tarkastaja. Analysoi, onko viesti, jonka käyttäjä haluaa lähettää roskapostia.
                    Jos viesti sisältää vain yhden virkkeen, irrallisia sanoja/kirjaimia tai se on alle 150 merkkiä, se on roskapostia.
                    Jos viesti ei sisällä konkreettisia seikkoja, toiminta-ehdotuksia tai rahoitustiedustelua, vaan pelkän aihe-ehdotuksen nimen, se on roskapostia.
                    Palauta käyttäjän viestistä arvio asteikolla 0-100, jossa 0 on asiallinen viesti ja 100 roskapostia, vastaa vain numerolla.`
        },
        {
          role: "user",
          content: JSON.stringify(message)
        }
      ]
    });

    //Parse spam probability from gpt4o-mini response
    //Set spam threshold as adjustable value from 0-100

    const aiResponse = spamCheck.choices[0].message.content;
    const spamLikelihood = parseInt(aiResponse!);
    const spamThreshold = 50;

    //Save email to supabase if it is not spam, do not save spam messages

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (spamLikelihood < spamThreshold) {

      const { error } = await supabase
      .from('emails')
      .insert({ sender: message.sender, recipient: message.recipient, subject: message.subject, message: message.message, spam_likelihood: spamLikelihood, specialist_response: message.specialistMessage });

      if (error) {
        throw new Error(JSON.stringify(error.message));
      }

    } else {
      console.log("Spam likelihood: " + spamLikelihood);
      throw new Error("Message filtered as spam");
    }

    return new Response((JSON.stringify(message)), {
      status: 202,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
       },
    });


  } catch (error) {

    console.log(error);
    return new Response(JSON.stringify(error), {status: 500});

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
  
});
