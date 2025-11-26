// Distinct bright color palette - each color is unique and clearly different
// All colors use black text for readability (white for dark backgrounds)
const COLOR_PALETTE = [
  { bg: '#FF6B6B', text: '#000000', border: '#E63946' }, // Coral Red
  { bg: '#FF9F1C', text: '#000000', border: '#E88504' }, // Orange
  { bg: '#FFEB3B', text: '#000000', border: '#FDD835' }, // Yellow
  { bg: '#4CAF50', text: '#000000', border: '#388E3C' }, // Green
  { bg: '#00BCD4', text: '#000000', border: '#0097A7' }, // Cyan
  { bg: '#2196F3', text: '#000000', border: '#1976D2' }, // Blue
  { bg: '#9C27B0', text: '#FFFFFF', border: '#7B1FA2' }, // Purple
  { bg: '#E91E63', text: '#000000', border: '#C2185B' }, // Pink
  { bg: '#795548', text: '#FFFFFF', border: '#5D4037' }, // Brown
  { bg: '#607D8B', text: '#FFFFFF', border: '#455A64' }, // Blue Grey
  { bg: '#8BC34A', text: '#000000', border: '#689F38' }, // Light Green
  { bg: '#03A9F4', text: '#000000', border: '#0288D1' }, // Light Blue
  { bg: '#CDDC39', text: '#000000', border: '#AFB42B' }, // Lime
  { bg: '#FF5722', text: '#000000', border: '#E64A19' }, // Deep Orange
  { bg: '#673AB7', text: '#FFFFFF', border: '#512DA8' }, // Deep Purple
  { bg: '#009688', text: '#FFFFFF', border: '#00796B' }, // Teal
  { bg: '#FFC107', text: '#000000', border: '#FFA000' }, // Amber
  { bg: '#3F51B5', text: '#FFFFFF', border: '#303F9F' }, // Indigo
  { bg: '#00ACC1', text: '#000000', border: '#00838F' }, // Dark Cyan (replaced Material Red)
  { bg: '#00E676', text: '#000000', border: '#00C853' }, // Bright Green
  { bg: '#FF4081', text: '#000000', border: '#F50057' }, // Pink Accent
  { bg: '#40C4FF', text: '#000000', border: '#00B0FF' }, // Light Blue Accent
  { bg: '#FFAB40', text: '#000000', border: '#FF9100' }, // Orange Accent
  { bg: '#69F0AE', text: '#000000', border: '#00E676' }, // Green Accent
];

// Store user color assignments and track which colors are used
const userColorMap = new Map<number, { bg: string; text: string; border: string }>();
const usedColorIndices = new Set<number>();

/**
 * Get a consistent color for a user based on their ID
 * Ensures each user gets a unique color when possible
 */
export function getUserColor(userId: number | null | undefined): { bg: string; text: string; border: string } {
  // Return default gray color if userId is null or undefined
  if (userId === null || userId === undefined) {
    return { bg: '#6c757d', text: '#FFFFFF', border: '#7d868f' }; // Bootstrap gray
  }

  if (userColorMap.has(userId)) {
    return userColorMap.get(userId)!;
  }

  // Find the next available color
  let colorIndex = (userId - 1) % COLOR_PALETTE.length;

  // If the basic modulo color is already used, find the next available one
  if (usedColorIndices.has(colorIndex)) {
    // Find first unused color
    for (let i = 0; i < COLOR_PALETTE.length; i++) {
      if (!usedColorIndices.has(i)) {
        colorIndex = i;
        break;
      }
    }
    // If all colors are used, wrap around
    if (usedColorIndices.has(colorIndex)) {
      colorIndex = (userId - 1) % COLOR_PALETTE.length;
    }
  }

  const color = COLOR_PALETTE[colorIndex];
  userColorMap.set(userId, color);
  usedColorIndices.add(colorIndex);

  return color;
}

/**
 * Get color for a user by name (for when we only have the name)
 * This uses a simple hash function to consistently assign colors
 */
export function getUserColorByName(userName: string): { bg: string; text: string; border: string } {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < userName.length; i++) {
    hash = userName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[colorIndex];
}

/**
 * Clear the color map (useful for testing)
 */
export function clearUserColorMap(): void {
  userColorMap.clear();
  usedColorIndices.clear();
}
