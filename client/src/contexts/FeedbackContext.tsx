import { createContext, useContext, useState, type ReactNode } from 'react';

interface FeedbackContextType {
  isOpen: boolean;
  openFeedback: () => void;
  closeFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <FeedbackContext.Provider
      value={{
        isOpen,
        openFeedback: () => setIsOpen(true),
        closeFeedback: () => setIsOpen(false),
      }}
    >
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedbackContext() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedbackContext must be used within FeedbackProvider');
  return ctx;
}
