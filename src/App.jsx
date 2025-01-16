import { createClient } from '@supabase/supabase-js';
import { useState } from 'react';

const App = () => {

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  const [supabaseResponseState, setSupabaseResponseState] = useState('');
  const [greetingState, setGreetingState] = useState('');

  const handleSubmit = async (event) => {
    try {
      event.preventDefault();
      const { data, error } = await supabase.functions.invoke('hankeai');
      setSupabaseResponseState(JSON.stringify(data[0]));
      setGreetingState("Hello " + event.target[0].value +"!");
      console.log(data[0]);
    } catch (error) {
      console.log(error);
    }
  }

    return (
      <div>
        <h1>Hankeideatyökalu</h1>
        <form onSubmit={handleSubmit}>
          <label>
            Hankeidea:
            <input type="text" id="hanke" name="hankeidea"></input>
          </label>
          <input type="submit" value="Sparraa"></input>
        </form>
        <div>{greetingState}</div>
        <div>{supabaseResponseState}</div>
      </div>
    );
  }

export default App;
