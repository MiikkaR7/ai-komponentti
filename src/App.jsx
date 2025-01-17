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

  const handleContactForm = async (formData) => {
    try {
      const nimi = formData.get("lomakenimi");
      const sposti = formData.get("lomakesposti");
      const hanke = formData.get("lomakehanke");
      const edustaja = formData.get("lomakevalikko");
      console.log(nimi + " " + sposti + " " + hanke + " " + edustaja);
    } catch (error) {
      console.log(error);
    }
  }

    return (
      <div className="ai-komponentti">
        <h1 className="komponentti-otsikko">Hankeideatyökalu</h1>
        <form className="hankeidea" onSubmit={handleSubmit}>
            <textarea className="ai-kentta" placeholder="Kirjoita hankeideasi tähän..." cols="100" rows="10" type="text" id="hanke" name="hankeidea"/>
          <input className="hankeidea-nappi" type="submit" value="Sparraa"/>
        </form>
        <div className="ai-vastaus">{supabaseResponseState.split('\n').map((line, index) => (
          <p key={index}>{line}</p>
        ))}</div>
        <h1 className="yhteydenottolomake-otsikko">Ota yhteyttä</h1>
        <form className="yhteydenottolomake" action={handleContactForm}>
          <input name="lomakenimi" className="yhteydenottolomake-nimi" placeholder="Nimi"></input>
          <input name="lomakesposti" className="yhteydenottolomake-sposti" placeholder="Sähköpostiosoite"></input>
          <input name="lomakehanke" className="yhteydenottolomake-hanke" placeholder="Hankeidea"></input>
          <select name="lomakevalikko" className="yhteydenottolomake-valikko">
            <option value="miikka.riipi@testi.com">miikka.riipi@testi.com</option>
          </select>
          <textarea className="yhteydenottolomake-viesti" placeholder="Viesti" cols="100" rows="10" type="text" id="viesti" name="hankeviesti"/>
          <input className="yhteydenottolomake-nappi" type="submit" value="Lähetä"/>
        </form>
      </div>
    );
  }

export default App;
