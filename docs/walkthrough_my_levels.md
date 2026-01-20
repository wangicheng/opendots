# Walkthrough - My Levels Page

I have added a new "Mine" tab to the Level Selection screen to allow you to browse your own levels.

## Changes

### 1. Mock Data Update
Ref: `src/game/services/MockLevelService.ts`

- Added a `CURRENT_USER_ID` constant ('user_me') to simulate a logged-in user.
- Updated the mock `authors` list to include "Me" (the current user), so that some built-in levels are assigned to you for testing purposes.

### 2. Level Selection UI Update
Ref: `src/game/ui/LevelSelectionUI.ts`

- Added a "Mine" button in the header alongside "Latest" and "Popular".
- Implemented `viewMode` logic to switch between 'latest', 'popular', and 'mine'.
- When "Mine" is selected:
  - The level list is filtered to show only levels where `authorId` matches `CURRENT_USER_ID`.
  - The filter status text displays "My Levels".
  - Sorting defaults to 'latest' (by creation date).

## How to Test

1. Open the Level Selection screen.
2. You will see "Latest", "Popular", and "Mine" buttons in the top header.
3. Click on **Mine**.
4. The list should update to show only levels assigned to "Me" (e.g., Level 4 in the mock data set).
5. Click "Latest" or "Popular" to return to the global view.
