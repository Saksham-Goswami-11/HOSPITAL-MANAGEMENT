import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TooltipProps {
    children: React.ReactNode;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
    delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
    children,
    content,
    position = 'bottom',
    className,
    delay = 0.3
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        const id = setTimeout(() => {
            setIsVisible(true);
        }, delay * 1000);
        setTimeoutId(id);
    };

    const handleMouseLeave = () => {
        if (timeoutId) clearTimeout(timeoutId);
        setIsVisible(false);
    };

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    };

    const arrowClasses = {
        top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-slate-800 border-x-transparent border-b-transparent',
        bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-b-slate-800 border-x-transparent border-t-transparent',
        left: 'right-[-4px] top-1/2 -translate-y-1/2 border-l-slate-800 border-y-transparent border-r-transparent',
        right: 'left-[-4px] top-1/2 -translate-y-1/2 border-r-slate-800 border-y-transparent border-l-transparent'
    };

    return (
        <div 
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: position === 'bottom' ? -5 : position === 'top' ? 5 : 0 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className={cn(
                            "absolute z-[100] px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg shadow-xl shadow-slate-200/50 whitespace-nowrap pointer-events-none border border-slate-700/50 backdrop-blur-sm",
                            positionClasses[position],
                            className
                        )}
                    >
                        {content}
                        <div className={cn(
                            "absolute w-0 h-0 border-4",
                            arrowClasses[position]
                        )} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
