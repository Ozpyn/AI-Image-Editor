// components/ui/ProgressBar.jsx
import { useState, useEffect } from 'react';
import { Sparkles, CheckCircle, XCircle } from 'lucide-react';

export default function ProgressBar({ 
  isProcessing, 
  progress = 0, 
  status = "Processing...", 
  error = null,
  onComplete,
  onCancel 
}) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  // Control visibility based on props
  useEffect(() => {
    if (isProcessing) {
      setShouldShow(true);
    } else if (!isProcessing && progress === 100 && !error) {
      // Completed successfully - keep showing for a moment then hide
      const timer = setTimeout(() => {
        setShouldShow(false);
        if (onComplete) onComplete();
      }, 2000);
      return () => clearTimeout(timer);
    } else if (!isProcessing && error) {
      // Error occurred - keep showing for a moment then hide
      const timer = setTimeout(() => {
        setShouldShow(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (!isProcessing) {
      // Not processing and no special case - hide immediately
      setShouldShow(false);
    }
  }, [isProcessing, progress, error, onComplete]);

  // Smooth progress animation
  useEffect(() => {
    if (shouldShow && isProcessing) {
      const interval = setInterval(() => {
        setDisplayProgress(prev => {
          if (prev < progress) {
            return Math.min(prev + 1, progress);
          }
          return prev;
        });
      }, 20);
      return () => clearInterval(interval);
    }
  }, [shouldShow, isProcessing, progress]);

  // Show confetti on completion
  useEffect(() => {
    if (progress === 100 && !error && shouldShow) {
      setShowConfetti(true);
    } else {
      setShowConfetti(false);
    }
  }, [progress, error, shouldShow]);

  // Don't render if shouldShow is false
  if (!shouldShow) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-panel/90 rounded-xl border border-white/10 p-6 max-w-md w-full mx-4 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Sparkles className={[
                "h-5 w-5",
                isProcessing ? "text-accent animate-pulse" : "",
                error ? "text-red-500" : "",
                !isProcessing && progress === 100 && !error ? "text-green-500" : ""
              ].join(" ")} />
              {showConfetti && (
                <div className="absolute -top-1 -right-1">
                  <span className="flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                </div>
              )}
            </div>
            <h3 className="text-lg font-semibold text-white">
              {error ? 'Processing Failed' : 
               !isProcessing && progress === 100 ? 'Complete!' : 
               'AI Processing'}
            </h3>
          </div>
          
          {/* Cancel button - only show while processing */}
          {isProcessing && onCancel && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white transition-colors"
              title="Cancel"
            >
              <XCircle className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Status message */}
        <p className={[
          "text-sm mb-3",
          error ? "text-red-400" : "text-gray-300"
        ].join(" ")}>
          {error ? error : status}
        </p>

        {/* Progress bar */}
        <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-4">
          <div 
            className={[
              "absolute left-0 top-0 h-full rounded-full transition-all duration-300",
              error ? "bg-red-500" : 
              !isProcessing && progress === 100 ? "bg-green-500" : 
              "bg-accent"
            ].join(" ")}
            style={{ width: `${error ? 100 : displayProgress}%` }}
          >
            {/* Animated shimmer effect - only while processing */}
            {isProcessing && !error && progress < 100 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            )}
          </div>
        </div>

        {/* Progress percentage and details */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            {error ? 'Failed' : 
             !isProcessing && progress === 100 ? 'Complete' : 
             `${Math.round(displayProgress)}% complete`}
          </span>
          
          {/* Show close button for completed operations */}
          {!isProcessing && progress === 100 && !error && (
            <button
              onClick={() => setShouldShow(false)}
              className="flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Close</span>
            </button>
          )}
        </div>

        {/* Confetti animation */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: '-10%',
                  width: `${Math.random() * 8 + 4}px`,
                  height: `${Math.random() * 8 + 4}px`,
                  background: `hsl(${Math.random() * 360}, 100%, 50%)`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${Math.random() * 2 + 1}s`
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}