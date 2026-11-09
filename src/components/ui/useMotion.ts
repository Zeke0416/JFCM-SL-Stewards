import { createContext, useContext } from 'react';
export const MotionContext = createContext({ paused: false, toggle: () => {} });
export const useMotion = () => useContext(MotionContext);
