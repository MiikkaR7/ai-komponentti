import { createClient } from '@supabase/supabase-js';
import { useState } from 'react';
import './App.css';

const App = () => {

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  const [contactFormVisibilityState, setContactFormVisibilityState] = useState(true);
  const [supabaseResponseState, setSupabaseResponseState] = useState(<div className="ai-response"></div>);
  const [supabasePromptButtonState, setSupabasePromptButtonState] = useState(<input className="user-prompt-form-button" type="submit" value="Sparraa" />);
  const [modalOpenState, setModalOpenState] = useState(false);
  const [userPromptState, setUserPromptState] = useState('');

  const handleSubmit = async (event) => {

    setContactFormVisibilityState(false);
    setSupabasePromptButtonState(<></>);
    setSupabaseResponseState(<div className="loading-spinner"></div>);

    try {

      event.preventDefault();
      const { data } = await supabase.functions.invoke('hankeai', {
        body: { query: event.target[0].value }
      });

      setSupabaseResponseState(
        <div className="ai-response">{data.reply.split('\n').map((line, index) => (
          <p key={index}>{line}</p>
        ))}</div>
        );

      setSupabasePromptButtonState(<input className="user-prompt-form-button" type="submit" value="Sparraa" />)
      setContactFormVisibilityState(true);

    } catch (error) {

      setContactFormVisibilityState(true);
      setSupabaseResponseState(
        <div className="ai-response-error">
          <p>Error: {error.message}</p>
        </div>
      );

    }
  }

  const handleContactForm = async (formData, formElement) => {

    //TODO: implement verified sender address and real recipients

    setModalOpenState(!modalOpenState);

    const hankeaihe = formData.get('contact-form-subject');
    const sposti = formData.get('contact-form-sender');
    const edustaja = formData.get('contact-form-recipient');
    const viesti = formData.get('contact-form-message');

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

  const handleContinue = () => {
    setModalOpenState(false);
  }

  const handleNewUserInput = () => {
    setUserPromptState('');
    setSupabaseResponseState(<div className="ai-response"></div>);
    setModalOpenState(false);
  }

  const handleUserInput = (e) => {
    setUserPromptState(e.target.value)
  }

  return (
    <>
      {modalOpenState ? (
          <div className="user-continue-prompt">
            <div>
              <p className="user-continue-prompt-header">Kiitti!</p>
              <p className="user-continue-prompt-message">Jatka sparraamista samalla idealla?</p>
            </div>
            <div className="user-continue-prompt-buttons">
              <button onClick={handleContinue} className="prompt-form-button">
                Jatka samalla
              </button>
              <button onClick={handleNewUserInput} className="prompt-form-button-reverse">
                Uusi idea
              </button>
            </div>
          </div>

      ) : (

        <div className="ai-komponentti">
          <h1 className="komponentti-header">Hankeideatyökalu</h1>
          <form className="user-prompt-form" onSubmit={handleSubmit}>
            <textarea
              value={userPromptState}
              onChange={handleUserInput}
              name="user-prompt"
              className="user-prompt-form-textarea"
              placeholder="Kirjoita hankeideasi tähän..."
              cols="100"
              rows="10"
              type="text"
              maxLength="544"
              required
            />
            {supabasePromptButtonState}
          </form>
          {supabaseResponseState}

        {contactFormVisibilityState ?

          <>
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
              <input 
                name="contact-form-name"
                className="contact-form-inputs-input"
                placeholder="Nimi" 
                required/>
              <input
                name="contact-form-sender"
                className="contact-form-inputs-input"
                placeholder="Sähköpostiosoite"
                type="email"
                required/>
              <input 
                name="contact-form-subject"
                className="contact-form-inputs-input"
                placeholder="Hankeidea" 
                required/>
              <select 
                name="contact-form-recipient" 
                className="contact-form-select">
                <option value="miikka@testi.fi">miikka@testi.fi</option>
              </select>
            </div>
            <textarea
              name="contact-form-message"
              placeholder="Viesti"
              className="contact-form-textarea"
              type="text"
              cols="100"
              rows="10"
              required
            />
            <input className="contact-form-button" type="submit" value="Lähetä" />
          </form>
          </>
        : 
        <>
        </>
        }
          
        </div>
      )}
    </>
  );
  

}

export default App;
