// Bright pastel color palette - clear backgrounds with black bold text
// All colors use black text for readability
const COLOR_PALETTE = [
  { bg: '#FFB3B3', text: '#000000', border: '#FF8080' }, // Light Red/Pink
  { bg: '#FFD9B3', text: '#000000', border: '#FFBF80' }, // Light Orange
  { bg: '#FFFFB3', text: '#000000', border: '#FFFF80' }, // Light Yellow
  { bg: '#B3FFB3', text: '#000000', border: '#80FF80' }, // Light Green
  { bg: '#B3FFFF', text: '#000000', border: '#80FFFF' }, // Light Cyan
  { bg: '#B3D9FF', text: '#000000', border: '#80BFFF' }, // Light Blue
  { bg: '#D9B3FF', text: '#000000', border: '#BF80FF' }, // Light Purple
  { bg: '#FFB3E6', text: '#000000', border: '#FF80D4' }, // Light Magenta
  { bg: '#FFCCCC', text: '#000000', border: '#FF9999' }, // Soft Red
  { bg: '#FFE5CC', text: '#000000', border: '#FFCC99' }, // Soft Orange
  { bg: '#E6FFB3', text: '#000000', border: '#D4FF80' }, // Lime Green
  { bg: '#B3FFE6', text: '#000000', border: '#80FFD4' }, // Mint Green
  { bg: '#CCE5FF', text: '#000000', border: '#99CCFF' }, // Sky Blue
  { bg: '#E6CCFF', text: '#000000', border: '#D699FF' }, // Lavender
  { bg: '#FFCCE5', text: '#000000', border: '#FF99CC' }, // Rose Pink
  { bg: '#FFE6B3', text: '#000000', border: '#FFD480' }, // Peach
  { bg: '#C2F0C2', text: '#000000', border: '#99E699' }, // Pale Green
  { bg: '#C2E0F0', text: '#000000', border: '#99CCE6' }, // Pale Blue
  { bg: '#F0C2E0', text: '#000000', border: '#E699CC' }, // Pale Pink
  { bg: '#F0E6C2', text: '#000000', border: '#E6D499' }, // Pale Yellow
  { bg: '#C2F0F0', text: '#000000', border: '#99E6E6' }, // Pale Cyan
  { bg: '#E0C2F0', text: '#000000', border: '#CC99E6' }, // Pale Violet
  { bg: '#F0D9C2', text: '#000000', border: '#E6C299' }, // Pale Tan
  { bg: '#D9F0C2', text: '#000000', border: '#C2E699' }, // Pale Lime
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
