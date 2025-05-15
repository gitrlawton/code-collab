import React from "react";

export default function LoadingScreen({
  message = "Loading your collaborative space",
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Code brackets with fixed width to ensure consistent spacing */}
        <div className="w-32 flex justify-between">
          <span className="text-3xl text-foreground">&#123;</span>
          <span className="text-3xl text-foreground">&#125;</span>
        </div>

        {/* Wave animation dots - perfectly centered */}
        <div className="absolute flex items-center justify-center space-x-2">
          <div className="dot-wave-1 w-2 h-2 bg-current rounded-full"></div>
          <div className="dot-wave-2 w-2 h-2 bg-current rounded-full"></div>
          <div className="dot-wave-3 w-2 h-2 bg-current rounded-full"></div>
        </div>
      </div>

      <p className="text-foreground text-lg font-medium">{message}</p>
      {message.includes("may take") ? null : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Hang tight, this may take a few moments.
        </p>
      )}

      {/* Add the pure wave animation CSS */}
      <style jsx>{`
        .dot-wave-1,
        .dot-wave-2,
        .dot-wave-3 {
          animation: wave 1.3s ease-in-out infinite;
        }

        .dot-wave-2 {
          animation-delay: 0.2s;
        }

        .dot-wave-3 {
          animation-delay: 0.4s;
        }

        @keyframes wave {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </div>
  );
}
