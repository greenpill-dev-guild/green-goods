// Mock for Display components
export const ImageWithFallback = ({ src, alt, className, ...props }) => {
  return { type: "img", props: { src, alt, className, ...props } };
};
