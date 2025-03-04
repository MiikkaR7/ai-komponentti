import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabase, openAI } from "../supabase.ts";
import { corsHeaders } from "../corsHeaders.ts";
import { Ratelimit } from "../rateLimit.ts";

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {

    await Ratelimit(100, 86400000, 4);

    const email = await req.json();
    const message = email.message;

    //Use AI to detect misuse/spam/junk messages

    const spamCheck = await openAI.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Olet roskapostia estävä tarkastaja. Analysoi, onko viesti, jonka käyttäjä haluaa lähettää roskapostia.
                    Viesti on roskapostia, jos se sisältää:
                    - alle 150 merkkiä
                    - irrallisia sanoja tai kirjaimia
                    - ei sisällä konkreettisia seikkoja, toiminta-ehdotuksia tai rahoitustiedustelua
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

});
