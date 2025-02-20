import './Accordion.css';

const Accordion = ({ title, isOpen, toggle, children }) => {

    return (
        <div className="accordion" onClick={toggle}>
            {title}
            {isOpen ? <span className="accordion-open-close">-</span> : <span className="accordion-open-close">+</span>}
            <div className={`accordion-content ${isOpen ? "open" : ""}`}>{isOpen && children}</div>
        </div>
    );
}

export default Accordion;