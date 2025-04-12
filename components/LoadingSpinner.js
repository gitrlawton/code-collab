export default function LoadingSpinner({ size = "default" }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    default: "w-8 h-8",
    lg: "w-12 h-12",
  };

  const spinnerSize = sizeClasses[size] || sizeClasses.default;

  return (
    <div className="flex justify-center items-center">
      <div
        className={`${spinnerSize} border-4 border-t-foreground border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin`}
      ></div>
    </div>
  );
}
