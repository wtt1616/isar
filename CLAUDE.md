# Claude Development Log

This document tracks all features and changes implemented with Claude Code assistance.

## Table of Contents
- [Recent Changes](#recent-changes)
- [Feature: User Profile Management](#feature-user-profile-management)
- [Feature: Color-Coded Schedules](#feature-color-coded-schedules)
- [Deployment History](#deployment-history)

---

## Recent Changes

### 2025-11-17: User Profile & Color-Coded Schedules

Two major features were added to the iSAR system:

1. **User Profile Management** - Users can now view and update their profile information and change passwords
2. **Color-Coded Schedules** - Each Imam and Bilal gets a unique color in schedules with distribution tracking

---

## Feature: User Profile Management

### Overview
Added comprehensive user profile management allowing users to view and update their personal information and change their password securely.

### Files Created

#### 1. `app/api/profile/route.ts`
- **Purpose**: API endpoint for fetching and updating user profile data
- **Methods**:
  - `GET`: Fetches user profile (name, email, role, phone, is_active)
  - `PUT`: Updates user profile with email uniqueness validation

#### 2. `app/api/profile/change-password/route.ts`
- **Purpose**: Secure password change endpoint
- **Security Features**:
  - Verifies current password before allowing change
  - Requires new password confirmation
  - Minimum 6 character password length
  - Uses bcrypt for password hashing

#### 3. `app/dashboard/profile/page.tsx`
- **Purpose**: User-facing profile management interface
- **Features**:
  - Tabbed interface (Profile Information / Change Password)
  - Form validation
  - Success/error notifications
  - Role-based information display

### Files Modified

#### `components/Navbar.tsx`
- **Changes**:
  - Replaced simple logout button with dropdown menu
  - Added "My Profile" link with person icon
  - Maintained logout functionality with visual separation

### Usage
1. Users click their name in the navbar
2. Select "My Profile" from dropdown
3. Can switch between two tabs:
   - **Profile Information**: Update name, email, phone
   - **Change Password**: Securely change password

### Security Considerations
- Session-based authentication required
- Current password verification for password changes
- Email uniqueness validation
- Password hashing with bcrypt (10 rounds)
- All inputs validated server-side

---

## Feature: Color-Coded Schedules

### Overview
Implemented unique color coding for each Imam and Bilal in schedules to help Head Imam identify weekly distribution at a glance. Each user gets a consistent, unique color with a color legend showing distribution counts.

### Files Created

#### `lib/userColors.ts`
- **Purpose**: Centralized color management system
- **Features**:
  - 24 unique color combinations (background, text, border)
  - Smart color assignment algorithm preventing duplicates
  - Consistent colors per user ID
  - Color tracking with Map and Set
- **Functions**:
  - `getUserColor(userId)`: Get unique color for user by ID
  - `getUserColorByName(userName)`: Get color by name using hash
  - `clearUserColorMap()`: Reset color assignments (for testing)

### Color Palette
24 distinct colors including:
- Dark Red, Dark Blue, Dark Green, Orange, Indigo
- Dark Yellow, Dark Cyan, Dark Magenta, Dark Olive
- Firebrick, Midnight Blue, Dark Slate Gray, Crimson
- Royal Blue, Forest Green, Dark Orange, Medium Purple
- Goldenrod, Light Sea Green, Medium Violet Red, Yellow Green
- Indian Red, Slate Blue, Steel Blue

### Files Modified

#### `app/dashboard/page.tsx`
- **Changes**:
  - Added color legend at top showing all Imams/Bilals with distribution counts
  - Applied unique colors to Imam and Bilal cells in schedule
  - Color format: `{background, text, border}`
  - Shows count badges (e.g., "5x" meaning 5 appearances that week)

#### `app/schedules/manage/page.tsx`
- **Changes**:
  - Same color implementation as dashboard
  - Color legend with distribution tracking
  - Maintains consistency across all schedule views

#### `app/globals.css`
- **Changes**:
  - Added print-specific CSS for color preservation
  - `print-color-adjust: exact` for accurate color printing
  - `-webkit-print-color-adjust: exact` for Safari/Chrome
  - Maintains colored borders in print view
  - Hides color legend and buttons when printing

### Color Assignment Algorithm
1. Check if user already has assigned color (return cached)
2. Calculate initial color index: `(userId - 1) % 24`
3. If color already used, find first unused color
4. Track used colors to prevent duplicates
5. If all 24 colors used, wrap around with modulo

### Usage
- Colors automatically appear in schedules
- Color legend shows at top of schedule pages
- Each Imam/Bilal has unique color when < 24 users
- Distribution counts show appearances per week
- Colors preserved when printing schedules

### Print Compatibility
- Colors print correctly on all modern browsers
- Color legend hidden in print view
- Border colors maintained for clarity
- Optimized for A4 landscape printing

---

## Deployment History

### Production Server Details
- **URL**: https://isar.myopensoft.net
- **SSH**: `ssh myopensoft-isar@isar.myopensoft.net -p 8288`
- **Password**: R57aVmtLpj6JvFHREbtt
- **App Directory**: ~/isar
- **Process Manager**: PM2

### Deployment Process (2025-11-17)

#### Initial Git Setup on Production
```bash
cd ~/isar
git init
git remote add origin https://github.com/wtt1616/isar.git
git fetch origin
git checkout -b main origin/main
```

#### Standard Deployment Steps
```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build production version
npm run build

# Restart PM2 process
pm2 restart isar

# Verify deployment
pm2 logs isar --lines 20
```

### Local Development Workflow

#### Making Changes Locally
1. Make changes on local machine (C:\Users\Lenovo\iSAR)
2. Test changes: `npm run dev` (runs on http://localhost:3000)
3. Commit changes to Git:
   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin main
   ```

#### Deploying to Production
1. SSH into production server
2. Navigate to app directory: `cd ~/isar`
3. Pull latest changes: `git pull origin main`
4. Install dependencies: `npm install`
5. Build: `npm run build`
6. Restart: `pm2 restart isar`
7. Verify: `pm2 logs isar --lines 20`

### Common Issues & Solutions

#### Port 3000 in Use (Local Development)
**Problem**: Dev server can't start on port 3000
**Solution**:
```bash
# Windows
taskkill /F /IM node.exe

# Then restart dev server
npm run dev
```

#### Git Remote Already Exists
**Problem**: Error when adding remote: "remote origin already exists"
**Solution**: Remote is already configured, skip `git remote add` and proceed with `git pull`

#### Compilation Errors After Changes
**Problem**: Syntax errors or compilation issues after adding features
**Solution**: Restart dev server to clear webpack cache
```bash
# Stop dev server (Ctrl+C)
# Restart
npm run dev
```

---

## Database Changes

No database schema changes were required for these features. All functionality uses existing `users` table with columns:
- `id` (primary key)
- `name`
- `email`
- `password` (bcrypt hashed)
- `role` (head_imam, imam, bilal)
- `phone`
- `is_active`

---

## Testing Checklist

### User Profile Feature
- [ ] Users can access profile from navbar dropdown
- [ ] Profile information displays correctly
- [ ] Users can update name, email, phone
- [ ] Email uniqueness is enforced
- [ ] Password change requires current password
- [ ] Password change requires confirmation
- [ ] Minimum 6 character password enforced
- [ ] Success/error messages display correctly
- [ ] Unauthorized access is blocked

### Color-Coded Schedules
- [ ] Each Imam has unique color
- [ ] Each Bilal has unique color
- [ ] Color legend displays at top of schedules
- [ ] Distribution counts are accurate
- [ ] Colors consistent across dashboard and manage pages
- [ ] Colors preserved when printing
- [ ] Color legend hidden when printing
- [ ] No color duplicates when < 24 users

---

## Future Enhancements

### Potential Improvements
1. **Profile Photos**: Add user avatar upload functionality
2. **Email Notifications**: Notify users of profile changes
3. **Password Reset**: Add "Forgot Password" functionality
4. **Color Customization**: Allow Head Imam to customize user colors
5. **Export Options**: Add CSV/PDF export for schedules with colors
6. **Activity Log**: Track profile changes for audit purposes

### Technical Debt
- Consider adding rate limiting for password change attempts
- Implement more robust password requirements (special chars, numbers)
- Add unit tests for color assignment algorithm
- Consider Redis caching for color assignments in high-traffic scenarios

---

## Dependencies Added

No new dependencies were added for these features. Used existing packages:
- `bcryptjs` - Password hashing
- `next-auth` - Session management
- `mysql2` - Database operations
- `react` - UI components
- `bootstrap` - Styling

---

## Notes

- Color assignments are reset on server restart (in-memory Map/Set)
- For persistent color assignments, consider database storage
- 24 colors supports up to 24 users without duplication
- Profile updates require re-login if email is changed (session email doesn't auto-update)

---

**Last Updated**: 2025-11-17
**Updated By**: Claude Code
**Version**: iSAR v1.2
