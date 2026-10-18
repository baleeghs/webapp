/** Screen sizes every page must work at: phone, tablet, laptop and a wide desktop. */
export const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'wide', width: 2560, height: 1440 },
] as const;
