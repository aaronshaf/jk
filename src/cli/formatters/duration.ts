/**
 * Format duration in milliseconds to human-readable string
 */
export const formatDuration = (durationMs: number): string => {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${seconds}s`;
};

/**
 * Format timestamp to human-readable date/time
 */
export const formatTimestamp = (timestamp: string | number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};
