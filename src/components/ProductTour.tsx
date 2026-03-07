import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTour } from '@/context/TourContext';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

export const ProductTour: React.FC = () => {
    const { isTourActive, currentStepIndex, steps, nextStep, prevStep, endTour } = useTour();
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Compute position of the target element
    useEffect(() => {
        if (!isTourActive || steps.length === 0) return;

        const currentStep = steps[currentStepIndex];
        if (currentStep.targetId === 'center') {
            setTargetRect(null); // Center mode
            return;
        }

        const element = document.getElementById(currentStep.targetId);
        if (element) {
            // Scroll to element if not in view
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Compute position after a tiny delay to allow scrolling
            setTimeout(() => {
                const rect = element.getBoundingClientRect();
                setTargetRect(rect);
            }, 300);
        } else {
            // If element not found, fallback to center or retry
            setTargetRect(null);
        }
    }, [isTourActive, currentStepIndex, steps, windowSize]);

    if (!isTourActive || steps.length === 0) return null;

    const currentStep = steps[currentStepIndex];

    // Dialog placement logic
    const isCenter = !targetRect || currentStep.targetId === 'center';

    let dialogStyle: React.CSSProperties = {};
    if (isCenter) {
        dialogStyle = {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
        };
    } else if (targetRect) {
        // Try to place to the right, or bottom, based on available space
        const padding = 20;
        const dialogWidth = 400; // estimated
        const dialogHeight = 200; // estimated

        if (targetRect.right + dialogWidth + padding < windowSize.width) {
            // Right
            dialogStyle = {
                top: Math.max(padding, targetRect.top),
                left: targetRect.right + padding,
            };
        } else if (targetRect.bottom + dialogHeight + padding < windowSize.height) {
            // Bottom
            dialogStyle = {
                top: targetRect.bottom + padding,
                left: Math.max(padding, targetRect.left),
            };
        } else if (targetRect.left - dialogWidth - padding > 0) {
            // Left
            dialogStyle = {
                top: Math.max(padding, targetRect.top),
                left: targetRect.left - dialogWidth - padding,
            };
        } else {
            // Top or fallback to bottom center
            dialogStyle = {
                bottom: padding,
                left: '50%',
                transform: 'translateX(-50%)',
            };
        }
    }

    return (
        <AnimatePresence>
            {isTourActive && (
                <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
                    {/* Overlay mask */}
                    <motion.div
                        className="absolute inset-0 bg-slate-900/60 transition-all duration-500"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            clipPath: targetRect && !isCenter
                                ? `polygon(
                    0% 0%, 0% 100%, 
                    ${targetRect.left - 10}px 100%, 
                    ${targetRect.left - 10}px ${targetRect.top - 10}px, 
                    ${targetRect.right + 10}px ${targetRect.top - 10}px, 
                    ${targetRect.right + 10}px ${targetRect.bottom + 10}px, 
                    ${targetRect.left - 10}px ${targetRect.bottom + 10}px, 
                    ${targetRect.left - 10}px 100%, 
                    100% 100%, 100% 0%
                  )`
                                : 'none'
                        }}
                    />

                    {/* Dialogue Box */}
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="absolute pointer-events-auto w-[calc(100%-40px)] max-w-[450px]"
                        style={dialogStyle}
                    >
                        <div className="relative bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col md:flex-row">
                            {/* Doctor Avatar - Left Side */}
                            <div className="bg-gradient-to-b from-blue-50 to-blue-100/50 p-4 md:p-6 flex items-end justify-center shrink-0 border-b md:border-b-0 md:border-r border-blue-100 relative">
                                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-blue-500/10 to-transparent" />
                                <img
                                    src="/assets/tour/doctor_guide.png"
                                    alt="Dr. Guide"
                                    className="w-24 h-auto md:w-32 object-contain relative z-10 drop-shadow-xl -mb-4 md:-mb-6"
                                />
                            </div>

                            {/* Content Area */}
                            <div className="p-6 md:p-8 flex flex-col flex-grow">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                        <h3 className="font-bold text-slate-900 text-lg tracking-tight">Dr. Guide</h3>
                                    </div>
                                    <button
                                        onClick={endTour}
                                        className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Title */}
                                <h4 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">
                                    {currentStep.title}
                                </h4>

                                {/* Body */}
                                <p className="text-slate-600 leading-relaxed min-h-[4rem] text-[15px]">
                                    {currentStep.content}
                                </p>

                                {/* Footer Controls */}
                                <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100">
                                    <span className="text-xs font-medium text-slate-400">
                                        Step {currentStepIndex + 1} of {steps.length}
                                    </span>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={prevStep}
                                            disabled={currentStepIndex === 0}
                                            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={nextStep}
                                            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                                        >
                                            {currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}
                                            {currentStepIndex !== steps.length - 1 && <ChevronRight className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
