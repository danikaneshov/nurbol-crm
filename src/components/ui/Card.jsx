export const Card = ({ children, className = '', ...props }) => {
  return (
    <div className={`bg-white border border-gray-200/60 rounded-xl ${className}`} {...props}>
      {children}
    </div>
  );
};
