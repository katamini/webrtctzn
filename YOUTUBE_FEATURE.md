# YouTube Player Block Feature

## Overview
This feature adds a synchronized YouTube player to the webRTCTZN application, allowing users in the same room to watch and control YouTube videos together in real-time.

## Implementation Details

### Files Modified
1. **index.html** - Added YouTube IFrame API and updated EXPERIMENT section
2. **script.js** - Added YouTube player state management and P2P synchronization
3. **styler.css** - Added styling for YouTube player UI

### Key Features
- **Video Loading**: Users can paste YouTube URLs or video IDs
  - Supported URL formats:
    - Direct video ID: `AhNoy1K_czQ`
    - Standard watch: `https://www.youtube.com/watch?v=AhNoy1K_czQ`
    - Short URL: `https://youtu.be/AhNoy1K_czQ`
    - Embed: `https://www.youtube.com/embed/AhNoy1K_czQ`
    - No-cookie embed: `https://www.youtube-nocookie.com/embed/AhNoy1K_czQ`
    - Shorts: `https://www.youtube.com/shorts/AhNoy1K_czQ`
    - Live: `https://www.youtube.com/live/AhNoy1K_czQ`
    - Mobile URLs: `https://m.youtube.com/watch?v=AhNoy1K_czQ`
    - URLs with parameters: `https://www.youtube.com/watch?v=AhNoy1K_czQ&t=10s`
- **Play/Pause Sync**: When one user plays or pauses, all peers see the same state
- **Seek Sync**: Seeking to a different time syncs across all peers
- **New Peer Sync**: When a new peer joins, they automatically receive the current video state

### P2P Synchronization
The feature uses Trystero's `makeAction` to create a dedicated "youtube" action channel that broadcasts:
- `videoLoad` - Video ID, start time, and player state
- `play` - Play command
- `pause` - Pause command
- `seek` - Seek to specific time

### Usage
1. Enter a YouTube URL or video ID in the input field
2. Click "Load" or press Enter
3. The video loads and syncs with all peers in the room
4. Any playback controls (play/pause/seek) are synchronized across all peers

## Testing
To test the feature:
1. Open the app in two browser windows with the same room ID
2. Paste a YouTube URL (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
3. Click "Load" in one window
4. Verify the video loads in both windows
5. Play/pause/seek in one window and verify it syncs to the other

## Technical Notes
- Uses YouTube IFrame API for player control
- Implements debouncing to prevent sync loops (via `isSyncingYouTube` flag)
- Seek detection runs every 500ms to catch manual timeline scrubbing
- Player state is sent to new peers when they join the room
