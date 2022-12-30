import * as React from 'react';

export type SPAContextValue = {
    ref: React.RefObject<HTMLElement>,
    widthPx: number,
    setWidthPx: React.Dispatch<React.SetStateAction<SPAContextValue['widthPx']>>,
    scrot: () => Promise<{ data: Uint8Array, width: number }>,
}

export const SPAContext = React.createContext<null | SPAContextValue>(null)

export const useSPAContext = () => React.useContext(SPAContext);
