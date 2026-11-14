import { useEffect } from 'react';

export interface SurfacePresentation {
  initialText: boolean;
  onPresented: () => void;
}

export function useTextPresentation(isText: boolean, onPresented: () => void) {
  useEffect(() => {
    if (!isText) return;
    const frame = requestAnimationFrame(onPresented);
    return () => cancelAnimationFrame(frame);
  }, [isText, onPresented]);
}
