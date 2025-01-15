import { createClient } from '@supabase/supabase-js'

const App = () => {

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

  const handleSubmit = async (event) => {
    try {
      event.preventDefault();
      const { data, error } = await supabase.functions.invoke('hankeai', {
        body: { name: event.target[0].value },
      })
      console.log(data);
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
