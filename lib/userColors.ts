// Vibrant color palette for users - bright, saturated colors for easy differentiation
// Based on the sample schedule with high contrast and white text
const COLOR_PALETTE = [
  { bg: '#8B4513', text: '#FFFFFF', border: '#A0522D' }, // Saddle Brown
  { bg: '#FF6600', text: '#FFFFFF', border: '#FF8533' }, // Bright Orange
  { bg: '#9932CC', text: '#FFFFFF', border: '#B24CE6' }, // Dark Orchid Purple
  { bg: '#32CD32', text: '#FFFFFF', border: '#4DE64D' }, // Lime Green
  { bg: '#00CED1', text: '#FFFFFF', border: '#1AE0E3' }, // Dark Turquoise
  { bg: '#FFD700', text: '#000000', border: '#FFE033' }, // Gold Yellow
  { bg: '#FF1493', text: '#FFFFFF', border: '#FF47AD' }, // Deep Pink
  { bg: '#87CEEB', text: '#000000', border: '#A0D8F0' }, // Sky Blue
  { bg: '#228B22', text: '#FFFFFF', border: '#2FA52F' }, // Forest Green
  { bg: '#FF4500', text: '#FFFFFF', border: '#FF6733' }, // Orange Red
  { bg: '#8B008B', text: '#FFFFFF', border: '#A500A5' }, // Dark Magenta
  { bg: '#00FF00', text: '#000000', border: '#33FF33' }, // Bright Green
  { bg: '#4169E1', text: '#FFFFFF', border: '#5A7FE6' }, // Royal Blue
  { bg: '#C71585', text: '#FFFFFF', border: '#D9339F' }, // Medium Violet Red
  { bg: '#7FFF00', text: '#000000', border: '#99FF33' }, // Chartreuse
  { bg: '#DC143C', text: '#FFFFFF', border: '#E63356' }, // Crimson
  { bg: '#00BFFF', text: '#FFFFFF', border: '#33CCFF' }, // Deep Sky Blue
  { bg: '#FF69B4', text: '#FFFFFF', border: '#FF8CC4' }, // Hot Pink
  { bg: '#8FBC8F', text: '#000000', border: '#A5CCA5' }, // Dark Sea Green
  { bg: '#FF8C00', text: '#FFFFFF', border: '#FFA533' }, // Dark Orange
  { bg: '#9370DB', text: '#FFFFFF', border: '#A98AE6' }, // Medium Purple
  { bg: '#20B2AA', text: '#FFFFFF', border: '#3AC2BA' }, // Light Sea Green
  { bg: '#CD853F', text: '#FFFFFF', border: '#D99F5F' }, // Peru Brown
  { bg: '#4682B4', text: '#FFFFFF', border: '#5F98C4' }, // Steel Blue
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
