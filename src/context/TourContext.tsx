import React, { createContext, useContext, useState } from 'react';

export interface TourStep {
    targetId: string;
    title: string;
    content: string;
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

    const startTour = (tourSteps: TourStep[]) => {
        setSteps(tourSteps);
        setCurrentStepIndex(0);
        setIsTourActive(true);
    };

    const nextStep = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        } else {
            endTour();
        }
    };

    const prevStep = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    const endTour = () => {
        setIsTourActive(false);
        setCurrentStepIndex(0);
        localStorage.setItem('medflow_tour_completed', 'true');
    };

    // Optional: Auto-start tour if not completed before when starting logic is outside
    // But usually we call startTour in the main layout if not completed.

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
