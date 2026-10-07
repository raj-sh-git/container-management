import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  title?: string;
  className?: string;
  iconClassName?: string;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  title = 'Refresh',
  className = 'p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all shadow-sm',
  iconClassName = 'w-4 h-4',
}) => {
  const [isSpinning, setIsSpinning] = useState(false);

  const handleClick = async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setTimeout(() => {
        setIsSpinning(false);
      }, 750);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      className={className}
    >
      <RefreshCw className={`${iconClassName} ${isSpinning ? 'animate-spin' : ''}`} />
    </button>
  );
};
