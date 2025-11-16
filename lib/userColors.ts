// Predefined color palette for users - expanded to 24 unique colors
const COLOR_PALETTE = [
  { bg: '#FFE5E5', text: '#8B0000', border: '#FF6B6B' }, // Dark Red
  { bg: '#E5F3FF', text: '#00008B', border: '#66B2FF' }, // Dark Blue
  { bg: '#E5FFE5', text: '#006400', border: '#66CC66' }, // Dark Green
  { bg: '#FFF3E5', text: '#CC6600', border: '#FFB366' }, // Orange
  { bg: '#F3E5FF', text: '#4B0082', border: '#B366FF' }, // Indigo
  { bg: '#FFFFE5', text: '#8B8B00', border: '#FFFF66' }, // Dark Yellow
  { bg: '#E5FFFF', text: '#008B8B', border: '#66CCCC' }, // Dark Cyan
  { bg: '#FFE5F3', text: '#8B008B', border: '#FF66B3' }, // Dark Magenta
  { bg: '#F3FFE5', text: '#556B2F', border: '#B3FF66' }, // Dark Olive
  { bg: '#FFE5CC', text: '#B22222', border: '#FF9966' }, // Firebrick
  { bg: '#E5E5FF', text: '#191970', border: '#9999FF' }, // Midnight Blue
  { bg: '#E5FFF3', text: '#2F4F4F', border: '#66FFCC' }, // Dark Slate Gray
  { bg: '#FFE0E0', text: '#DC143C', border: '#FF8888' }, // Crimson
  { bg: '#E0E0FF', text: '#4169E1', border: '#8888FF' }, // Royal Blue
  { bg: '#E0FFE0', text: '#228B22', border: '#88FF88' }, // Forest Green
  { bg: '#FFF0E0', text: '#FF8C00', border: '#FFC088' }, // Dark Orange
  { bg: '#F0E0FF', text: '#9370DB', border: '#C088FF' }, // Medium Purple
  { bg: '#FFFFE0', text: '#DAA520', border: '#FFFF88' }, // Goldenrod
  { bg: '#E0FFFF', text: '#20B2AA', border: '#88FFFF' }, // Light Sea Green
  { bg: '#FFE0F0', text: '#C71585', border: '#FF88C0' }, // Medium Violet Red
  { bg: '#F0FFE0', text: '#9ACD32', border: '#C0FF88' }, // Yellow Green
  { bg: '#FFE0D0', text: '#CD5C5C', border: '#FFA088' }, // Indian Red
  { bg: '#E0E0F0', text: '#6A5ACD', border: '#8888C0' }, // Slate Blue
  { bg: '#E0F0FF', text: '#4682B4', border: '#88C0FF' }, // Steel Blue
];

// Store user color assignments and track which colors are used
const userColorMap = new Map<number, { bg: string; text: string; border: string }>();
const usedColorIndices = new Set<number>();

/**
 * Get a consistent color for a user based on their ID
 * Ensures each user gets a unique color when possible
 */
export function getUserColor(userId: number): { bg: string; text: string; border: string } {
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
