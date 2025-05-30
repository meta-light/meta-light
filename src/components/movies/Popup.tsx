import React from 'react';
import styles from '../../styles/movies/Home.module.css';
import Image from 'next/image';

function Popup({ selected, closePopup }) {
	// if (!result || !result.Title) {
	// 	return null; // or render a placeholder/error message
	// }
	// if (!result || !result.Poster) {
	// 	return null; // or render a placeholder/error message
	// }
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
  
  export default Popup;
