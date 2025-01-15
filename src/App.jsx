const App = () => {

  const handleSubmit = (e) => {
    try {
      e.preventDefault();
      console.log("submit handled");
    } catch (error) {
      console.log(error);
    }
  }

    return (
      <div>
        <h1>Hankeideatyökalu</h1>
        <form onSubmit={handleSubmit}>
          <label for="hankeidea">Hankeidea:</label>
          <input type="text" id="hanke" name="hankeidea"></input>
          <input type="submit" value="Sparraa"></input>
        </form>
      </div>
    );
  }

export default App;
