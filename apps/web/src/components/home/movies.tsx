import React, { useState } from 'react';
import axios from 'axios';
import styles from '../styles/movies/Home.module.css';
import { OMDB_API_KEY } from '../../app/env';

export default function Movies() {
  const [state, setState] = useState({ s: "", results: [] as any[], selected: {} as any });
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const apiUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}`;
  const search = async () => {
    try {const response = await axios(apiUrl + "&s=" + state.s, { headers: {"Content-Type":"application/json"} }); let results = response.data.Search; setState(prevState => {return { ...prevState, results: results }});} 
    catch (error) {console.error('Error fetching data:', error);}
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
        if (results && results.length > 0) {const firstResult = results[0]; setState(prevState => ({ ...prevState, results: [...prevState.results, firstResult] }));}
      });
    } 
    catch (error) {console.error('Error fetching data:', error);}
  }

  const handleInput = (e) => {let s = e.target.value; setState(prevState => {return { ...prevState, s: s }});}
  let openPopup = id => {axios(apiUrl + "&i=" + id, { headers: {"Content-Type":"application/json"} }).then(({ data }) => {let result = data; setState(prevState => {return { ...prevState, selected: result }}); setIsPopupOpen(true);});}
  const closePopup = () => {setState(prevState => {return { ...prevState, selected: {} }}); setIsPopupOpen(false);}

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

function Results({ results, openPopup }) {
	return (
		<section className={styles.results}>
			{results && results.length === 0 ? (<p>Search for a movie and press enter</p>) : (
				results?.map((result) => {
					if (result && result.imdbID && result.Poster && result.Title) {
						return (<Result key={result.imdbID} result={result} openPopup={openPopup} />)
					}
				})
			)} {!results && <p>No results found.</p>}
		</section>
	);
}

function Popup({ selected, closePopup }) {
	const addToList = () => {
		const title = selected.Title + '\n';
		fetch('/api/addToMyList', {method: 'POST', headers: {'Content-Type': 'application/json',}, body: JSON.stringify({ title })})
			.then((response) => {if (response.ok) {console.log('Movie added to list successfully');} else {throw new Error('Error adding movie to list');}})
			.catch((error) => {console.error('Error adding movie to list:', error);});
	};
  
	return (
	  <section className={styles.popup}>
		<div className={styles.content}>
		  <h2>{selected && selected.Title ? selected.Title : ""} <span>({selected && selected.Year ? selected.Year : ""})</span></h2>
		  <p className={styles.rating}>Rating:⭐️ {selected && selected.Title ? selected.imdbRating : ""}</p>
		  <p id="rating"><span>Genre: {selected && selected.Genre ? selected.Genre : ""}</span></p>
		  <div className={styles.plot}><img src={selected && selected.Poster ? selected.Poster : ""} alt="" /><p>{selected && selected.Plot ? selected.Plot : ""}</p></div>
		  <button className={styles.close} onClick={closePopup}>Close</button>
		  <button className={styles.close} onClick={addToList}>Add to list</button>
		</div>
	  </section>
	);
}


function Search({ handleInput, search }) {
	return (
		<div>
			<input 
				placeholder="Search for movies..." 
				onChange={handleInput}
				onKeyPress={(e) => e.key === 'Enter' && search()}
			/>
		</div>
	);
}

function Result({ result, openPopup }) {
	return (
		<div className={styles.result} onClick={result && result.imdbID ? () => openPopup(result.imdbID) : () => { }}>
			<img src={result && result.Poster ? result.Poster : ""} alt=""/>
			<h3>{result && result.Title ? result.Title : ""}</h3>
		</div>
	)
}