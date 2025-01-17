import { createClient } from '@supabase/supabase-js';
import { useState } from 'react';
import './App.css';

const App = () => {

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  const [supabaseResponseState, setSupabaseResponseState] = useState('');

  const handleSubmit = async (event) => {
    try {
      event.preventDefault();
      const { data, error } = await supabase.functions.invoke('hankeai', {
        body: { query: event.target[0].value }
      });
      console.log(data.reply);
      setSupabaseResponseState(data.reply);
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
            <textarea className="ai-kentta" cols="60" rows="10" type="text" id="hanke" name="hankeidea"></textarea>
          </label>
          <input type="submit" value="Sparraa"></input>
        </form>
        <div>{supabaseResponseState.split('\n').map((line, index) => (
          <p key={index}>{line}</p>
        ))}</div>
      </div>
    );
  }

export default App;
