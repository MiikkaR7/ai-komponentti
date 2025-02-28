import { useState, useRef, useEffect } from 'react';
import { supabase } from './components/supabase.js';

import Accordion from './components/Accordion.jsx';

import './App.css';

const App = () => {

  // States for responses and buttons in application flow

  const [contactFormVisibilityState, setContactFormVisibilityState] = useState(true);
  const [supabaseResponseText, setSupabaseResponseText] = useState("");
  const [supabaseResponseState, setSupabaseResponseState] = useState("");
  const [supabaseExpertResponseState, setSupabaseExpertResponseState] = useState("");
  const [supabasePromptButtonState, setSupabasePromptButtonState] = useState(<input className="user-prompt-form-button" type="submit" value="Sparraa" />);
  const [contactFormState, setContactFormState] = useState(true);
  const [modalOpenState, setModalOpenState] = useState(false);
  const [userPromptState, setUserPromptState] = useState('');

  //Accordion states

  const [responseVisibilityState, setResponseVisibilityState] = useState(false);
  const [expertResponseVisibilityState, setExpertResponseVisibilityState] = useState(false);
  const [contactFormAccordionState, setContactFormAccordionState] = useState(false);
  const supabaseResponseRef = useRef(null);

  //User inputs

  const [contactFormNameState, setContactFormNameState] = useState("");
  const [contactFormSenderState, setContactFormSenderState] = useState("");
  const [contactFormSubjectState, setContactFormSubjectState] = useState("");
  const [contactFormRecipientState, setContactFormRecipientState] = useState("miikka@testi.fi");
  const [contactFormMessageState, setContactFormMessageState] = useState("");

  const handleUserInput = (e) => {
    setUserPromptState(e.target.value)
  }

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

  // Automatically scroll AI response
  // Scroll automatically unless user interacts with response (Better to stop scrolling entirely if user interacts?)

  const [userMouseDown, setUserMouseDown] = useState(false);
  const [responseFinishedState, setResponseFinishedState] = useState(true);

  const handleMouseDown = () => {
    setUserMouseDown(true);
  }

  const handleMouseUp = () => {
    setUserMouseDown(false);
  }

  useEffect(() => {
    
    if (!responseFinishedState) {

     if (!userMouseDown) {

      supabaseResponseRef.current?.scrollTop = supabaseResponseRef.current?.scrollHeight;

    }

  }

  }, [supabaseResponseText, userMouseDown, responseFinishedState]);

  // Response to entrepreneur using hankeai Edge function

  const fetchHankeai = async () => {
    try {
      const response = await fetch(process.env.SUPABASE_URL + "/functions/v1/hankeai", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": "Bearer " + process.env.SUPABASE_ANON_KEY 
        },
        body: JSON.stringify({ query: userPromptState }),
      });

      if (!response) {
        throw new Error('Error getting response');
      }

      setResponseFinishedState(false);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        setSupabaseResponseText(accumulatedText);
        setSupabaseResponseState(
          <button
            type="button"
            className="ai-response"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            ref={supabaseResponseRef}
          >
            {accumulatedText}
          </button>
        );
      }

      setResponseFinishedState(true);
    } catch (error) {
      setSupabaseResponseState(
        <div className="ai-response-error">
          <p>Error: {error.message}</p>
        </div>
      );
    }
  };

  // Response to AMK specialist

  const fetchExpert = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('hankeai-expert', {
        body: JSON.stringify({ query: userPromptState }),
      });
      if (error) {
        throw new Error('Expert response error');
      }
      setSupabaseExpertResponseState(
        <div className="ai-response">{data.reply}</div>
      );
    } catch (error) {
      setSupabaseExpertResponseState(
        <div className="ai-response-error">
          <p>Error: {error.message}</p>
        </div>
      );
    }
  };

  const handleSubmit = async (event) => {

    event.preventDefault();

    // Set loading states and open entrepreneur response accordion

    setResponseVisibilityState(true);
    setSupabasePromptButtonState(<input className="user-prompt-form-button-disabled" type="submit" value="Sparraa" disabled/>);
    setContactFormVisibilityState(false);
    setSupabaseResponseState(<div className="loading-spinner"></div>);
    setSupabaseExpertResponseState(<div className="loading-spinner"></div>);
  
    // Invoke both functions concurrently

    await Promise.all([fetchHankeai(), fetchExpert()]);
  
    // After both responses update the states and UI

    setSupabasePromptButtonState(
      <input className="user-prompt-form-button" type="submit" value="Sparraa" />
    );
    setContactFormVisibilityState(true);
  };


  //Contact form function

  const handleContactForm = async (event) => {

    event.preventDefault();

    if (supabaseExpertResponseState == "" || supabaseResponseText == "") {
      
      alert("Sparraa hankeideasi ensin");
      return;

    } else {

    setModalOpenState(!modalOpenState);

    const subject = contactFormSubjectState;
    const sender = contactFormSenderState;
    const recipient = contactFormRecipientState;
    const message = contactFormMessageState;
    const specialistMessage = supabaseExpertResponseState.props.children;

      const { error } = await supabase.functions.invoke('sendgrid', {
        body: {
          subject: subject,
          sender: sender,
          recipient: recipient,
          message: message,
          specialistMessage: specialistMessage
        }

      });

      if (error) {
        throw new Error('Error sending email');
      }

    }

  }

  //Function to fill contact form using AI response and Edge function prefill-form

  const handlePrefill = async () => {

    try {

      // Only allow prefill if sparraus has happened

      if (supabaseExpertResponseState == "" || supabaseResponseText == "") {
      
        alert("Sparraa hankeideasi ensin");
  
      } else {

      setContactFormState(false);
      
      const { data, error } = await supabase.functions.invoke('prefill-form', {
        body: JSON.stringify(supabaseResponseText)
      });

      if (error) {
        throw new Error('Error prefilling contact form');
      }

      // Autofill contact form based on AI response
      setContactFormSubjectState(data.subject);
      setContactFormRecipientState(data.recipient);
      setContactFormMessageState(data.message);

      setContactFormState(true);

      }

    } catch (error) {
      throw new Error(error.message);
    }

  }

  // After submitting contact form, continue prompt or new prompt

  const handleContinue = () => {
    setModalOpenState(false);
  }

  const handleNewUserInput = () => {
    setUserPromptState("");
    setSupabaseResponseText("");
    setSupabaseExpertResponseState("");

    setContactFormSubjectState("");
    setContactFormRecipientState("miikka@testi.fi");
    setContactFormMessageState("");

    setResponseVisibilityState(false);
    setExpertResponseVisibilityState(false);
    setContactFormAccordionState(false);
    setModalOpenState(false);

  }

  //Accordion close/open functions

  const handleResponseAccordion = (event) => {
    if (event.target.className === "ai-response") {
      event.stopPropagation();
      return;
    }
    setResponseVisibilityState(!responseVisibilityState);
  }

  const handleExpertAccordion = (event) => {
    if (event.target.className === "ai-response") {
      event.stopPropagation();
      return;
    }
    setExpertResponseVisibilityState(!expertResponseVisibilityState);
  }

  const handleContactFormAccordion = (event) => {

    // Dont trigger accordion if trying to use the contact form
    if (event.target.className !== "accordion" && event.target.className !== "accordion-open-close") {
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
            <button type="button" onClick={handleContinue} className="prompt-form-button">
              Jatka samalla
            </button>
            <button type="button" onClick={handleNewUserInput} className="prompt-form-button-reverse">
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

          <Accordion title="Tekoälyn vastaus" isOpen={responseVisibilityState} toggle={(e) => handleResponseAccordion(e)}>
            {supabaseResponseState}
          </Accordion>

          <Accordion title="DEMO: Expert response" isOpen={expertResponseVisibilityState} toggle={(e) => handleExpertAccordion(e)}>
            {supabaseExpertResponseState}
          </Accordion>

          {contactFormVisibilityState && (
            <Accordion title="Yhteydenottolomake" isOpen={contactFormAccordionState} toggle={(e) => handleContactFormAccordion(e)}>
              {contactFormState ? (
                  <form className="contact-form" onSubmit={handleContactForm}>
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
                      <input
                        value={contactFormSubjectState}
                        onChange={handleContactFormSubjectInput}
                        name="contact-form-subject"
                        className="contact-form-inputs-input"
                        placeholder="Hankeidea"
                        required
                      />
                      <textarea
                      value={contactFormMessageState}
                      onChange={handleContactFormMessageInput}
                      name="contact-form-message"
                      placeholder="Viesti"
                      className="contact-form-textarea"
                      required
                    />
                    <button type="button" onClick={handlePrefill} className="contact-form-button">Täytä</button>
                    <button type="submit" className="contact-form-button">Lähetä</button>
                    </div>
                  </form>
              ) : <div className="loading-spinner"></div>}
            </Accordion>
          )}
        </div>
      )}
    </>
  );

};

export default App;
