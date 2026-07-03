import React from 'react';
import SkillItem from './SkillItem';

const SkillCategory = ({ title, skills }) => {
  return (
    <>
      <h1>{title}</h1>
      <ul className="skillsGrid">
        {skills.map((skill, index) => (
          <SkillItem
            key={index}
            src={skill.src}
            alt={skill.alt}
            name={skill.name}
            width={skill.width}
            height={skill.height}
          />
        ))}
      </ul>
    </>
  );
};

export default SkillCategory; 