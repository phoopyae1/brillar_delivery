const randomSegment = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const generateTrackingCode = () => {
  const year = new Date().getFullYear();
  return `OFF-${year}-${randomSegment()}`;
};

module.exports = { generateTrackingCode };
