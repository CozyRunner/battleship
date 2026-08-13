# Troubleshooting & Networking

This guide helps resolve common issues related to connectivity, game state desynchronization, and performance.

## 1. Connection Issues

### "Failed to connect to server"

- **Cause**: The Socket.IO server (Vercel Function at `/api/socket`) may be down, WebSockets may be disabled for the project, or your internet connection is blocked.
- **Solution**:
  - Ensure the Vercel project has the **WebSockets** permission enabled.
  - Check that `VITE_SOCKET_URL` / `PUBLIC_SOCKET_PATH` are correct in your environment.
  - Ensure you are not behind a corporate firewall that blocks WebSockets.
  - Refresh the page to trigger a reconnection attempt.

### "Room Not Found"

- **Cause**: The Room ID is invalid or has expired.
- **Solution**: Double-check the room code with your opponent. Rooms are typically destroyed after 30 minutes of inactivity.

---

## 2. Gameplay Issues

### My screen says it's my turn, but I can't attack

- **Cause**: A temporary desynchronization between your client and the server.
- **Solution**: Wait 2-3 seconds for a `turn_changed` event. If it still doesn't work, refresh the page. The game will automatically restore your progress.

### A ship is overlapping another

- **Cause**: This shouldn't happen during valid play, but could occur due to local browser lag.
- **Solution**: Drag the ship again to a new valid position. The server will not allow you to click "Ready" until all overlaps are resolved.

---

## 3. Reconnection Flow

If you lose your internet connection or accidentally close the tab:

1. **Re-open the URL**: The game stores your session ID in `localStorage`.
2. **Auto-Join**: The client will attempt to auto-rejoin your active room.
3. **Restoration**: The server will send a `game_restored` event containing the current state of both boards and the turn order.

---

## 4. Performance Tips

If the game feels sluggish or animations are stuttering:

- **Enable Performance Mode**: Go to Settings and toggle **"Simplified Animations"**.
- **Close Background Tabs**: Socket.IO requires a steady CPU cycle to handle real-time packets efficiently.
- **Check Latency**: A ping > 500ms will cause a noticeable delay in attack feedback.
