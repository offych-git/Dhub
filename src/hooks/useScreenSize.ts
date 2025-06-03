
import { useState, useEffect } from 'react';

export const useScreenSize = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [screenWidth, setScreenWidth] = useState(0);

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setScreenWidth(width);
      setIsDesktop(width >= 1024); // lg breakpoint
      setIsMobile(width < 768); // md breakpoint
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return {
    isDesktop,
    isMobile,
    screenWidth,
    isTablet: !isDesktop && !isMobile
  };
};
