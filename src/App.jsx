import { createClient } from '@supabase/supabase-js';
import { useState } from 'react';
import './App.css';

const App = () => {

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  const [contactFormVisibilityState, setContactFormVisibilityState] =useState(true);
  const [supabaseResponseState, setSupabaseResponseState] = useState(
  <div className="ai-response"></div>
  );

  const handleSubmit = async (event) => {

    setContactFormVisibilityState(false);
    setSupabaseResponseState(<div className="loading-spinner"></div>);

    try {

      event.preventDefault();
      const { data, error } = await supabase.functions.invoke('hankeai', {
        body: { query: event.target[0].value }
      });

      setSupabaseResponseState(
        <div className="ai-response">{data.reply.split('\n').map((line, index) => (
          <p key={index}>{line}</p>
        ))}</div>
        );

      setContactFormVisibilityState(true);

    } catch (error) {

      console.log(error);
      setContactFormVisibilityState(true);
      setSupabaseResponseState(
        <div className="ai-response-error">
          <p>Error: rate limit reached, try again later</p>
        </div>
      );

    }
  }

  const handleContactForm = async (formData, formElement) => {

    //TODO: implement verified sender address and real recipients

    const hankeaihe = formData.get("contact-form-subject");
    const sposti = formData.get("contact-form-sender");
    const edustaja = formData.get("contact-form-recipient");
    const viesti = formData.get("contact-form-message");

      formElement.reset();

      try {

          const { data, error } = await supabase.functions.invoke('sendgrid', {
          body: { 
            aihe: hankeaihe,
            lahettaja: sposti,
            vastaanottaja: edustaja,
            viesti: viesti 
          }

      });
        
      } catch (error) {
        
        console.log(error);

      }

  }

  if (contactFormVisibilityState) {

    return (
    <div className="ai-komponentti">
        <h1 className="komponentti-header">Hankeideatyökalu</h1>
        <form className="user-prompt-form" onSubmit={handleSubmit}>
            <textarea className="user-prompt-form-textarea" placeholder="Kirjoita hankeideasi tähän..." cols="100" rows="10" type="text" maxlength="544" required/>
          <input className="user-prompt-form-button" type="submit" value="Sparraa"/>
        </form>
        {supabaseResponseState}
        <h1 className="contact-form-header">Ota yhteyttä</h1>
        <form
        className="contact-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          await handleContactForm(formData, e.target);
        }}
        >
          <div className="contact-form-inputs">
            <input name="contact-form-name" placeholder="Nimi" required></input>
            <input name="contact-form-sender" placeholder="Sähköpostiosoite" type="email" required></input>
            <input name="contact-form-subject" placeholder="Hankeidea" required></input>
            <select name="contact-form-recipient" className="contact-form-select">
              <option value="miikka@testi.fi">miikka@testi.fi</option>
            </select>
          </div>
          <textarea name="contact-form-message" placeholder="Viesti" className="contact-form-textarea" type="text" cols="100" rows="10" required/>
          <input className="contact-form-button" type="submit" value="Lähetä"/>
        </form>
      </div>
    );

  } else {

    return (
      <div className="ai-komponentti">
          <h1 className="komponentti-header">Hankeideatyökalu</h1>
          <form className="user-prompt-form" onSubmit={handleSubmit}>
              <textarea className="user-prompt-form-textarea" placeholder="Kirjoita hankeideasi tähän..." cols="100" rows="10" type="text" maxlength="544" required/>
            <input className="user-prompt-form-button-hidden" type="submit" value="Sparraa"/>
          </form>
          {supabaseResponseState}
          <h1 className="contact-form-header-hidden">Ota yhteyttä</h1>
          <form
          className="contact-form-hidden"
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            await handleContactForm(formData, e.target);
          }}
          >
            <div className="contact-form-inputs">
              <input name="contact-form-name" placeholder="Nimi" required></input>
              <input name="contact-form-sender" placeholder="Sähköpostiosoite" type="email" required></input>
              <input name="contact-form-subject" placeholder="Hankeidea" required></input>
              <select name="contact-form-recipient" className="contact-form-select">
                <option value="miikka@testi.fi">miikka@testi.fi</option>
              </select>
            </div>
            <textarea name="contact-form-message" placeholder="Viesti" className="contact-form-textarea" type="text" cols="100" rows="10" required/>
            <input className="contact-form-button" type="submit" value="Lähetä"/>
          </form>
        </div>
      );

  }

}

export default App;
