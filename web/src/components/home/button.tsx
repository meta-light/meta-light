export const Button = (props) => {
  const { text, onClick, className } = props
  return (<div onClick={() => onClick()} className={className}>{text}</div>)
}
export default Button