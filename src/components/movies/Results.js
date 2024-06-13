import React from 'react';
import Result from './Result';
import styles from '../../styles/movies/Home.module.css';

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

export default Results;


