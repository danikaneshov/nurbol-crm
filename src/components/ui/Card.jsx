export const Card = ({ children, className = '', variant = 'default', ...props }) => {
  const variants = {
    default: 'bg-white border border-slate-200 rounded-lg',
    elevated: 'bg-white border border-slate-200 rounded-lg shadow-sm',
    gradient: 'bg-slate-900 rounded-lg text-white', // No gradient, just solid dark
    glass: 'bg-white border border-slate-200 rounded-lg', // Ignore glass
    accent: 'bg-white border border-blue-200 rounded-lg',
  };

  return (
    <div className={`${variants[variant] || variants.default} ${className}`} {...props}>
      {children}
    </div>
  );
};
