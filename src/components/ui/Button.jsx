export const Button = ({ children, variant = 'primary', size = 'md', className = '', disabled = false, ...props }) => {
  const variants = {
    primary: 'bg-accent-600 hover:bg-accent-700 text-white',
    secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-600',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-sm',
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
