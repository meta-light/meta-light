import React, { useState } from 'react';
import Search from '../components/movies/Search';
import Results from '../components/movies/Results';
import axios from 'axios';
import Popup from '../components/movies/Popup';
import styles from '../styles/movies/Home.module.css';

function App()
{
  const [state, setState] = useState({ s: "", results: [], selected: {} });
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const apiUrl = "https://www.omdbapi.com/?apikey=72ff8aa9";

  const search = async () => {
    try {
      const response = await axios(apiUrl + "&s=" + state.s, { headers: {"Content-Type":"application/json"} });
      let results = response.data.Search;
      setState(prevState => {return { ...prevState, results: results }});
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  async function handleList() {
    try {
      const response = await fetch('/myList.txt');
      const data = await response.text();
      const movieList = data.split('\n');
      console.log(movieList);
      setState(prevState => ({ ...prevState, results: [] }));
      movieList.forEach(async (movie) => {
        const searchResponse = await axios(apiUrl + "&s=" + movie, { headers: {"Content-Type":"application/json"} });
        const results = searchResponse.data.Search;
        if (results && results.length > 0) {
          const firstResult = results[0];
          setState(prevState => ({ ...prevState, results: [...prevState.results, firstResult] }));
        } else { setState([]) }
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  const handleInput = (e) =>
  {
    let s = e.target.value;
    setState(prevState => {return { ...prevState, s: s }});
  }

  let openPopup = id => {
    axios(apiUrl + "&i=" + id, { headers: {"Content-Type":"application/json"} }).then(({ data }) => {
      let result = data;
      setState(prevState => {return { ...prevState, selected: result }});
      setIsPopupOpen(true);
    });
  }

  const closePopup = () => {
    setState(prevState => {return { ...prevState, selected: {} }});
    setIsPopupOpen(false);
  }

  return (
    <div className={styles.body}>
      <header className={styles.header}><h1>META MOVIES</h1></header>
      <main className={styles.main}>
        <Search handleInput={handleInput} search={search} />
        <br/>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={search} className='btn btn-main' style={{ display: isPopupOpen ? 'none' : 'block' }}>Search</button>
          <button onClick={handleList} className='btn btn-main' style={{ display: isPopupOpen ? 'none' : 'block' }}>Your List</button>
        </div>
        <Results results={state.results} openPopup={openPopup} />
        {(typeof state.selected.Title != "undefined") ? <Popup selected={state.selected} closePopup={closePopup} /> : false}
      </main>
    </div>
  );
}

export default App;
