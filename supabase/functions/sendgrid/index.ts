import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabase, openAI } from "../supabase.ts";
import { corsHeaders } from "../corsHeaders.ts";

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {

    // Rate limit using database table ratelimit_hankeai
    // Get table data

    const { data: fetchData, error: fetchError } = await supabase.from('ratelimit_hankeai').select('reset_at, requests, resets').eq('id', 4)

    if (fetchError) {
      throw new Error(fetchError.message);
    }
    
    // Set rate limit and reset threshold
    const rateLimit = 100;
    const resetTreshold = 86400000;

    // Get current amount of requests, resets and last reset time from table ratelimit_hankeai
    const requests = fetchData![0].requests;
    const resets = fetchData![0].resets;
    const resetAt = fetchData![0].reset_at;
    // Convert reset time timestamptz to Date and get current time
    const resetAtDate = new Date(resetAt);
    const currentTime = Date.now();

    // Calculate time difference between last reset than now, reset the time if 24 hours have passed
    const timeDifference = currentTime - resetAtDate.getTime();

    // Rate limit logic, first check if more than 24 hours have passed since last reset, then enforce rate limit, after that allow request
    if (timeDifference > resetTreshold) {

      console.log("Rate limit expired, resetting")
      const { error: timeError } = await supabase
      .from('ratelimit_hankeai')
      .update({reset_at: new Date().toISOString().split('.')[0] + "+00:00"})
      .eq('id', 4)

      const { error: requestsError } = await supabase
      .from('ratelimit_hankeai')
      .update({requests: 1})
      .eq('id', 4)

      const { error: resetError } = await supabase
      .from('ratelimit_hankeai')
      .update({resets: resets + 1})
      .eq('id', 4)

      if (timeError || requestsError || resetError) {
        throw new Error("Error resetting rate limit");
      }

    } else if (requests >= rateLimit) {

      // Rate limit is 100 requests in 24 hours
      throw new Error("Rate limit exceeded");

    } else {

      const { error } = await supabase
      .from('ratelimit_hankeai')
      .update({ requests: requests + 1})
      .eq('id', 4)

      if (error) {
        throw new Error(error.message);
      }

    }

    const message = await req.json();

    //Use AI to detect misuse/spam/junk messages

    const spamCheck = await openAI.chat.completions.create({
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
