import { createClient } from '@supabase/supabase-js';
import { useState, useRef, useEffect } from 'react';
import './App.css';

const App = () => {

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  const [contactFormVisibilityState, setContactFormVisibilityState] = useState(true);
  const [supabaseResponseState, setSupabaseResponseState] = useState("");
  const [supabaseExpertResponseState, setSupabaseExpertResponseState] = useState("");
  const [supabasePromptButtonState, setSupabasePromptButtonState] = useState(<input className="user-prompt-form-button" type="submit" value="Sparraa" />);
  const [modalOpenState, setModalOpenState] = useState(false);
  const [userPromptState, setUserPromptState] = useState('');

  //Accordions

  const [responseVisibilityState, setResponseVisibilityState] = useState(false);
  const [expertResponseVisibilityState, setExpertResponseVisibilityState] = useState(false);
  const [contactFormAccordionState, setContactFormAccordionState] = useState(false);
  const supabaseResponseRef = useRef(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setContactFormVisibilityState(false);
    setSupabasePromptButtonState(<input className="user-prompt-form-button-disabled" value="Sparraa" disabled />);
    setSupabaseResponseState(<div className="loading-spinner"></div>);
    setResponseVisibilityState(true);
    setSupabaseExpertResponseState(<div className="loading-spinner"></div>);
  
    try {

      const { data } = await supabase.functions.invoke('hankeai-expert', {
        body: JSON.stringify({query: userPromptState})
      });

      await setSupabaseExpertResponseState(
        <>
        <div className="ai-response">{data.reply.split('\n').map((line, index) => (
          <p key={index}>{line}</p>
        ))}</div>
        </>
      );

      const response = await fetch(process.env.SUPABASE_URL + "/functions/v1/hankeai", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.SUPABASE_ANON_KEY },
        body: JSON.stringify({ query: userPromptState }),
      });
  
      if (!response.body) throw new Error("No response body");
  
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
  
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
  
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
  
        setSupabaseResponseState(<div className="ai-response" ref={supabaseResponseRef}>{accumulatedText}</div>);

      }
    } catch (error) {
      setSupabaseResponseState(
        <div className="ai-response-error">
          <p>Error: {error.message}</p>
        </div>
      );
    }
    setSupabasePromptButtonState(<input className="user-prompt-form-button" type="submit" value="Sparraa" />);
    setContactFormVisibilityState(true);
  };

  useEffect(() => {
    if (supabaseResponseRef.current) {
      supabaseResponseRef.current.scrollTop = supabaseResponseRef.current.scrollHeight;
    }
  }, [supabaseResponseState]);
  
  

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
    setSupabaseResponseState("");
    setSupabaseExpertResponseState("");
    setResponseVisibilityState(false);
    setExpertResponseVisibilityState(false);
    setContactFormAccordionState(false);
    setModalOpenState(false);
  }

  const handleUserInput = (e) => {
    setUserPromptState(e.target.value)
  }

  const handleResponseAccordion = () => {
    setResponseVisibilityState(!responseVisibilityState);
  }

  const handleExpertAccordion = () => {
    setExpertResponseVisibilityState(!expertResponseVisibilityState);
  }

  const handleContactFormAccordion = () => {
    setContactFormAccordionState(!contactFormAccordionState);
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
              type="text"
              maxLength="500"
              required
            />
            {supabasePromptButtonState}
          </form>
          
          <button className="accordion" onClick={handleResponseAccordion}>Tekoälyn vastaus {responseVisibilityState ? <span className="accordion-open-close">▲</span> : <span className="accordion-open-close">▼</span>}</button>
          {responseVisibilityState && <>{supabaseResponseState}</>}
          
          <button className="accordion" onClick={handleExpertAccordion}>DEMO: Asiantuntijalle vastaus {expertResponseVisibilityState ? <span className="accordion-open-close">▲</span> : <span className="accordion-open-close">▼</span>}</button>
          {expertResponseVisibilityState && <>{supabaseExpertResponseState}</>}
          
          {contactFormVisibilityState && (
            <>
            <button className="accordion" onClick={handleContactFormAccordion}>Yhteydenottolomake {contactFormAccordionState ? <span className="accordion-open-close">▲</span> : <span className="accordion-open-close">▼</span>}</button>
            {contactFormAccordionState && 
            (<div className="accordion-content">
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
                      required
                    />
                    <input
                      name="contact-form-sender"
                      className="contact-form-inputs-input"
                      placeholder="Sähköpostiosoite"
                      type="email"
                      required
                    />
                    <input 
                      name="contact-form-subject"
                      className="contact-form-inputs-input"
                      placeholder="Hankeidea" 
                      required
                    />
                    <select 
                      name="contact-form-recipient" 
                      className="contact-form-select"
                    >
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
              </div>)}
            </>
          )}
        </div>
      )}
    </>
  );

  

}

export default App;
