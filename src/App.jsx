import { createClient } from '@supabase/supabase-js';
import { useState, useRef, useEffect } from 'react';
import './App.css';

const App = () => {

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  //States for responses and buttons in application flow

  const [contactFormVisibilityState, setContactFormVisibilityState] = useState(true);
  const [supabaseResponseText, setSupabaseResponseText] = useState("");
  const [supabaseResponseState, setSupabaseResponseState] = useState("");
  const [supabaseExpertResponseState, setSupabaseExpertResponseState] = useState("");
  const [supabasePromptButtonState, setSupabasePromptButtonState] = useState(<input className="user-prompt-form-button" type="submit" value="Sparraa" />);
  const [modalOpenState, setModalOpenState] = useState(false);
  const [userPromptState, setUserPromptState] = useState('');

  //Simulate streaming and automatically scroll AI response

  useEffect(() => {
    setSupabaseResponseState(<div className="ai-response" ref={supabaseResponseRef}>{supabaseResponseText}</div>);
    if (supabaseResponseRef.current) {
      supabaseResponseRef.current.scrollTop = supabaseResponseRef.current.scrollHeight;
    };
  }, [supabaseResponseText]);
  

  //Accordions

  const [responseVisibilityState, setResponseVisibilityState] = useState(false);
  const [expertResponseVisibilityState, setExpertResponseVisibilityState] = useState(false);
  const [contactFormAccordionState, setContactFormAccordionState] = useState(false);
  const supabaseResponseRef = useRef(null);

  //Contact form inputs

  const [contactFormNameState, setContactFormNameState] = useState("");
  const [contactFormSenderState, setContactFormSenderState] = useState("");
  const [contactFormSubjectState, setContactFormSubjectState] = useState("");
  const [contactFormRecipientState, setContactFormRecipientState] = useState("miikka@testi.fi");
  const [contactFormMessageState, setContactFormMessageState] = useState("");

  const handleContactFormNameInput = (e) => {
    setContactFormNameState(e.target.value);
  }

  const handleContactFormSenderInput = (e) => {
    setContactFormSenderState(e.target.value);
  }

  const handleContactFormSubjectInput = (e) => {
    setContactFormSubjectState(e.target.value);
  }

  const handleContactFormRecipientInput = (e) => {
    setContactFormRecipientState(e.target.value);
  }

  const handleContactFormMessageInput = (e) => {
    setContactFormMessageState(e.target.value);
  }
  //openAI API function

  const handleSubmit = async (event) => {
    event.preventDefault();

    //Open AI response accordion, hide contact form and submit button and render loading spinner

    setResponseVisibilityState(true);
    setContactFormVisibilityState(false);
    setSupabasePromptButtonState(
      <input className="user-prompt-form-button-disabled" value="Sparraa" disabled />
    );
    setSupabaseResponseText("");
    setSupabaseResponseState(<div className="loading-spinner"></div>);
    setSupabaseExpertResponseState(<div className="loading-spinner"></div>);

    //Response to AMK Specialist/Expert
  
    try {
      const { data, error } = await supabase.functions.invoke(
        'hankeai-expert',
        {
          body: JSON.stringify({ query: userPromptState }),
        }
      );
  
      if (error) {
        throw new Error('Expert response error');
      }
  
      setSupabaseExpertResponseState(
        <div className="ai-response">
          {data.reply.split('\n').map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      );
  
    } catch (error) {
      setSupabaseExpertResponseState(
        <div className="ai-response-error">
          <p>Error: {error.message}</p>
        </div>
      );
    }

    //Response to entrepreneur
  
    try {
      const { data, error } = await supabase.functions.invoke('hankeai', {
        body: JSON.stringify({ query: userPromptState }),
      });
  
      if (error) {
        throw new Error('AI response error');
      }

      //Autofill contact form based on AI response
  
      setContactFormSubjectState(data.subject);
      setContactFormRecipientState(data.recipient);
      setContactFormMessageState(data.message);

      //Simulate streaming by rendering the text letter by letter
  
      let i = -1;
      const interval = setInterval(() => {
        if (i < (data.content.length - 1)) {
          setSupabaseResponseText((prev) => prev + data.content[i]);
          i++;
        } else {
          clearInterval(interval);
        }
      }, 15);
  
    } catch (error) {
      setSupabaseResponseState(
        <div className="ai-response-error">
          <p>Error: {error.message}</p>
        </div>
      );
    }
  
    setSupabasePromptButtonState(
      <input className="user-prompt-form-button" type="submit" value="Sparraa" />
    );
    setContactFormVisibilityState(true);
  };
  

  //Contact form function

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

  //After submitting contact form, continue prompt or new prompt

  const handleContinue = () => {
    setModalOpenState(false);
  }

  const handleNewUserInput = () => {
    setUserPromptState("");
    setSupabaseResponseState("");
    setSupabaseExpertResponseState("");

    setContactFormSubjectState("");
    setContactFormRecipientState("miikka@testi.fi");
    setContactFormMessageState("");

    setResponseVisibilityState(false);
    setExpertResponseVisibilityState(false);
    setContactFormAccordionState(false);
    setModalOpenState(false);

  }

  //Track user input

  const handleUserInput = (e) => {
    setUserPromptState(e.target.value)
  }

  //Accordion close/open functions

  const handleResponseAccordion = () => {
    setResponseVisibilityState(!responseVisibilityState);
  }

  const handleExpertAccordion = () => {
    setExpertResponseVisibilityState(!expertResponseVisibilityState);
  }

  const handleContactFormAccordion = (event) => {

    // Dont trigger function if trying to use the contact form
    if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || event.target.tagName === "SELECT" || event.target.tagName === "SPAN") {
      event.stopPropagation();
      return;
    }
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
          
          <button className="accordion" onClick={handleResponseAccordion}>
            Tekoälyn vastaus
            {responseVisibilityState ? <span className="accordion-open-close">-</span> : <span className="accordion-open-close">+</span>}
            <div className={`accordion-content ${responseVisibilityState ? "open" : ""}`}>
              {responseVisibilityState && <>{supabaseResponseState}</>}
            </div>
          </button>
          
          <button className="accordion" onClick={handleExpertAccordion}>DEMO: Asiantuntijalle vastaus
            {expertResponseVisibilityState ? <span className="accordion-open-close">-</span> : <span className="accordion-open-close">+</span>}
            <div className={`accordion-content ${expertResponseVisibilityState ? "open" : ""}`}>
              {expertResponseVisibilityState && <>{supabaseExpertResponseState}</>}
            </div>
          </button>

          {contactFormVisibilityState && (
            <button className="accordion" onClick={(e) => handleContactFormAccordion(e)}>
              Yhteydenottolomake
              {contactFormAccordionState ? <span className="accordion-open-close">-</span> : <span className="accordion-open-close">+</span>}
              <div className={`accordion-content ${contactFormAccordionState ? "open" : ""}`}>
                {contactFormAccordionState && (
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
                        value={contactFormNameState}
                        onChange={handleContactFormNameInput} 
                        name="contact-form-name"
                        className="contact-form-inputs-input"
                        placeholder="Nimi" 
                        required
                      />
                      <input
                        value={contactFormSenderState}
                        onChange={handleContactFormSenderInput}
                        name="contact-form-sender"
                        className="contact-form-inputs-input"
                        placeholder="Sähköpostiosoite"
                        type="email"
                        required
                      />
                      <input
                        value={contactFormSubjectState}
                        onChange={handleContactFormSubjectInput} 
                        name="contact-form-subject"
                        className="contact-form-inputs-input"
                        placeholder="Hankeidea"
                        required
                      />
                      <select
                        value={contactFormRecipientState}
                        onChange={handleContactFormRecipientInput} 
                        name="contact-form-recipient" 
                        className="contact-form-select"
                      >
                        <option value="miikka@testi.fi">miikka@testi.fi</option>
                        <option value="pertti.rauhala@lapinamk.fi">pertti.rauhala@lapinamk.fi</option>
                        <option value="salla.pyhajarvi@lapinamk.fi">salla.pyhajarvi@lapinamk.fi</option>
                        <option value="saara.koho@lapinamk.fi">saara.koho@lapinamk.fi</option>
                        <option value="mirva.tapaninen@lapinamk.fi">mirva.tapaninen@lapinamk.fi</option>
                        <option value="jyrki.huhtaniska@lapinamk.fi">jyrki.huhtaniska@lapinamk.fi</option>
                        <option value="anne-mari.vaisanen@lapinamk.fi">anne-mari.vaisanen@lapinamk.fi</option>
                      </select>
                    </div>
                    <textarea
                      value={contactFormMessageState}
                      onChange={handleContactFormMessageInput}
                      name="contact-form-message"
                      placeholder="Viesti"
                      className="contact-form-textarea"
                      required
                    />
                    <input className="contact-form-button" type="submit" value="Lähetä" />
                  </form>
                )}
              </div>
            </button>
          )}
        </div>
      )}
    </>
  );

  

}

export default App;
