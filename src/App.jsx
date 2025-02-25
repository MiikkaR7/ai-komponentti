import { useState, useRef, useEffect } from 'react';
import { supabase } from './components/supabase.js';

import Accordion from './components/Accordion.jsx';

import './App.css';

const App = () => {

  //States for responses and buttons in application flow

  const [contactFormVisibilityState, setContactFormVisibilityState] = useState(true);
  const [supabaseResponseText, setSupabaseResponseText] = useState("Lähetä hankeideasi, jotta saat vastauksen!");
  const [supabaseResponseState, setSupabaseResponseState] = useState("");
  const [supabaseExpertResponseState, setSupabaseExpertResponseState] = useState("");
  const [supabasePromptButtonState, setSupabasePromptButtonState] = useState(<input className="user-prompt-form-button" type="submit" value="Sparraa" />);
  const [modalOpenState, setModalOpenState] = useState(false);
  const [userPromptState, setUserPromptState] = useState('');

  //Simulate streaming and automatically scroll AI response
  //Stop automatic scrolling if user interacts with response text

  const [userMouseDown, setUserMouseDown] = useState(false);
  const [responseFinishedState, setResponseFinishedState] = useState(true);

  const handleMouseDown = () => {
    setUserMouseDown(true);
  }

  const handleMouseUp = () => {
    setUserMouseDown(false);
  }

  //useEffect updates supabaseResponseState with incoming text
  //Scroll automatically unless user interacts with response (Better to stop scrolling entirely if user interacts?)

  useEffect(() => {
    setSupabaseResponseState(
    <button 
      className="ai-response"
      onScroll={handleMouseDown}
      onScrollEnd={handleMouseUp}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      ref={supabaseResponseRef}>

        {supabaseResponseText}

    </button>);

    if (!responseFinishedState) {

     if (!userMouseDown) {

      supabaseResponseRef.current?.scrollTop = supabaseResponseRef.current?.scrollHeight;

    }

  }

  }, [supabaseResponseText, userMouseDown, responseFinishedState]);


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

  //Response to entrepreneur using hankeai Edge function

  const handleSubmit = async (event) => {
    event.preventDefault();

    //Entrepreneur response accordion, hide contact form and submit button and render loading spinner

    setResponseVisibilityState(true);
    setContactFormVisibilityState(false);
    setSupabasePromptButtonState(
      <input className="user-prompt-form-button-disabled" value="Sparraa" disabled />
    );
    setSupabaseResponseState(<div className="loading-spinner"></div>);
    setSupabaseExpertResponseState(<div className="loading-spinner"></div>);

    //Call edge function

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
      //Set response as not finished until it is

      setResponseFinishedState(false);
      setSupabaseResponseText("");
      let i = -1;
      const interval = setInterval(async () => {
        if (i < (data.content.length - 1)) {
          await setSupabaseResponseText((prev) => prev + data.content[i]);
          i++;
        } else {
          clearInterval(interval);
          setResponseFinishedState(true);
        }
      }, 15);

    } catch (error) {
      setSupabaseResponseState(
        <div className="ai-response-error">
          <p>Error: {error.message}</p>
        </div>
      );
    }

    //Response to AMK Specialist/Expert

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

    //After getting responses, make Sparraa-button clickable again and make contact form visible

    setSupabasePromptButtonState(
      <input className="user-prompt-form-button" type="submit" value="Sparraa"/>
    );
    setContactFormVisibilityState(true);
  };


  //Contact form function

  const handleContactForm = async (formData, formElement) => {

    //TODO: implement verified sender address and real recipients

    setModalOpenState(!modalOpenState);

    const subject = formData.get('contact-form-subject');
    const sender = formData.get('contact-form-sender');
    const recipient = formData.get('contact-form-recipient');
    const message = formData.get('contact-form-message');
    const specialistMessage = supabaseExpertResponseState.props.children;

    formElement.reset();

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

          <Accordion title="Tekoälyn vastaus" isOpen={responseVisibilityState} toggle={(e) => handleResponseAccordion(e)}>
            {supabaseResponseState}
          </Accordion>

          <Accordion title="DEMO: Expert response" isOpen={expertResponseVisibilityState} toggle={(e) => handleExpertAccordion(e)}>
            {supabaseExpertResponseState}
          </Accordion>

          {contactFormVisibilityState && (
            <Accordion title="Yhteydenottolomake" isOpen={contactFormAccordionState} toggle={(e) => handleContactFormAccordion(e)}>
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
                    <input className="contact-form-button" type="submit" value="Lähetä" />
                    </div>
                  </form>
            </Accordion>
          )}
        </div>
      )}
    </>
  );

};

export default App;
