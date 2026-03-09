import React, { createContext, useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface TourStep {
    targetId: string;
    title: string;
    content: string;
    route?: string;
}

interface TourContextType {
    isTourActive: boolean;
    currentStepIndex: number;
    steps: TourStep[];
    startTour: (steps: TourStep[]) => void;
    nextStep: () => void;
    prevStep: () => void;
    endTour: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isTourActive, setIsTourActive] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [steps, setSteps] = useState<TourStep[]>([]);
    const navigate = useNavigate();

    const startTour = useCallback((tourSteps: TourStep[]) => {
        setSteps(tourSteps);
        setCurrentStepIndex(0);
        setIsTourActive(true);

        // Handle initial route if specified (only if it's a full path)
        if (tourSteps[0]?.route && tourSteps[0].route.startsWith('/')) {
            navigate(tourSteps[0].route);
        }
    }, [navigate]);

    const endTour = useCallback(() => {
        setIsTourActive(false);
        setCurrentStepIndex(0);
        localStorage.setItem('aarogya_nidhi_tour_completed', 'true');
    }, []);

    const nextStep = useCallback(() => {
        if (!steps || steps.length === 0) return;

        const nextIndex = currentStepIndex + 1;
        if (nextIndex < steps.length) {
            const nextStepObj = steps[nextIndex];
            if (nextStepObj.route && nextStepObj.route.startsWith('/') && window.location.hash.split('#')[1] !== nextStepObj.route) {
                navigate(nextStepObj.route);
            }
            setCurrentStepIndex(nextIndex);
        } else {
            endTour();
        }
    }, [steps, currentStepIndex, navigate, endTour]);

    const prevStep = useCallback(() => {
        if (!steps || steps.length === 0) return;

        const prevIndex = currentStepIndex - 1;
        if (prevIndex >= 0) {
            const prevStepObj = steps[prevIndex];
            if (prevStepObj.route && prevStepObj.route.startsWith('/') && window.location.hash.split('#')[1] !== prevStepObj.route) {
                navigate(prevStepObj.route);
            }
            setCurrentStepIndex(prevIndex);
        }
    }, [steps, currentStepIndex, navigate]);

    return (
        <TourContext.Provider value={{ isTourActive, currentStepIndex, steps, startTour, nextStep, prevStep, endTour }}>
            {children}
        </TourContext.Provider>
    );
};

export const useTour = () => {
    const context = useContext(TourContext);
    if (context === undefined) {
        throw new Error('useTour must be used within a TourProvider');
    }
    return context;
};
