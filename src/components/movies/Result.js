import React from 'react';
import styles from '../../styles/movies/Home.module.css';
import Image from 'next/image';

function Result({ result, openPopup }) {
	return (
		<div className={styles.result} onClick={result && result.imdbID ? () => openPopup(result.imdbID) : () => { }}>
			<img src={result && result.Poster ? result.Poster : ""} alt=""/>
			<h3>{result && result.Title ? result.Title : ""}</h3>
		</div>
	)
}

export default Result
