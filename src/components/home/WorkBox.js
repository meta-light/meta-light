import React from 'react';
import Image from 'next/image';

const WorkBox = ({ images, title, company, companyUrl, techStack, children }) => {
  return (
    <article className="workBox">
      {images && (
        <div className="workImageContainer">
          {images.map((image, index) => (
            <React.Fragment key={index}>
              <Image src={image.src} alt={image.alt} width={500} height={500} unoptimized/>
              {index < images.length - 1 && <br/>}
            </React.Fragment>
          ))}
        </div>
      )}
      <div className="workDescribeContainer">
        <h3>
          {title}
          {company && companyUrl && (
            <> @ <a href={companyUrl} target="_blank" rel="noopener noreferrer" className='h3Style'>{company}</a></>
          )}
          {company && !companyUrl && <> @ {company}</>}
        </h3>
        {techStack && (
          <h4>
            {techStack.map((tech, index) => (
              <React.Fragment key={index}>
                <span className="techStack">{tech}</span>
                {index < techStack.length - 1 && ','}
              </React.Fragment>
            ))}
          </h4>
        )}
        {children}
      </div>
    </article>
  );
};

export default WorkBox; 