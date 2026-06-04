export const Button = ({ children, variant = 'primary', size = 'md', className = '', disabled = false, ...props }) => {
  const variants = {
    primary: 'bg-slate-900 hover:bg-slate-800 text-white',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200',
    danger: 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-100',
    success: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100',
    ghost: 'hover:bg-slate-100 text-slate-600',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-md',
    md: 'px-4 py-2 text-sm rounded-md',
    lg: 'px-5 py-2.5 text-sm rounded-lg',
  };

  return (
    <button
      className={`font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
