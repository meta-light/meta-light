export const Button = ({ text, onClick, className, showIcon = false }) => {
  return (
    <button onClick={onClick} className={className}>
      {showIcon && <i className={className} style={{ visibility: 'hidden' }}></i>}
      {text}
    </button>
  );
};

export default Button;