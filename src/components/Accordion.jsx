import './Accordion.css';

const Accordion = ({ title, isOpen, toggle, children }) => {

    return (
        <button className="accordion" onClick={toggle}>
            {title}
            {isOpen ? <span className="accordion-open-close">-</span> : <span className="accordion-open-close">+</span>}
            <div className={`accordion-content ${isOpen ? "open" : ""}`}>{isOpen && children}</div>
        </button>
    );
}

export default Accordion;