import React from 'react';
import Image from 'next/image';

const SkillItem = ({ src, alt, name, width = 35, height = 35 }) => {
  return (
    <li>
      <div className="itemContainer">
        <Image src={src} alt={alt} width={width} height={height} unoptimized/>
        <p>{name}</p>
      </div>
    </li>
  );
};

export default SkillItem; 