import React, { createContext, useContext, useState, useCallback } from 'react';

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

    const startTour = useCallback((tourSteps: TourStep[]) => {
        setSteps(tourSteps);
        setCurrentStepIndex(0);
        setIsTourActive(true);
    }, []);

    const endTour = useCallback(() => {
        setIsTourActive(false);
        setCurrentStepIndex(0);
        localStorage.setItem('medflow_tour_completed', 'true');
    }, []);

    const nextStep = useCallback(() => {
        setCurrentStepIndex(prev => {
            if (steps && prev < steps.length - 1) {
                return prev + 1;
            } else {
                endTour();
                return prev;
            }
        });
    }, [steps, endTour]);

    const prevStep = useCallback(() => {
        setCurrentStepIndex(prev => (prev > 0 ? prev - 1 : prev));
    }, []);

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
