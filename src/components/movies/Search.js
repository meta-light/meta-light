import React from 'react';
import styles from '../../styles/movies/Home.module.css';

function Search({ handleInput, search })
{
  return (
    <section>
      <input
        type="text"
        placeholder="Find whatever you want"
        className={styles.searchbox}
        onChange={handleInput}
        onKeyPress={search}
      />
    </section>
  )
}
export default Search
