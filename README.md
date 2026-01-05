<img width="434" height="75" alt="image" src="https://github.com/user-attachments/assets/4354b88f-a10b-4841-a30d-dec9b5a12a3d" />

#### Decentralized p2p dWebRTC for CTZN with multi-network peer discovery.

## [Try It](https://rtctzn.com)
Audio & Video Chat, Whiteboarding, Image and Screensharing with a minimal interface.



![ezgif com-gif-maker (20)](https://user-images.githubusercontent.com/1423657/111086318-bad40380-851b-11eb-84b9-5246f1f08bc7.gif)

## Features

- **Decentralized P2P**: No central server required, uses Trystero for peer discovery
- **Audio/Video Chat**: Real-time communication with WebRTC
- **Auto-Reconnection**: Intelligent stream health monitoring and automatic recovery
- **Screen Sharing**: Share your screen with room participants
- **Collaborative Whiteboard**: Draw together in real-time
- **Chat**: Text messaging with URL detection
- **Room-based**: Create or join custom rooms

## Connection Reliability

The application implements robust connection handling:

- **Session Persistence**: Automatically restores your streaming state when you reload the page
- **Automatic Stream Recovery**: Streams automatically reconnect on errors or disconnections
- **Health Monitoring**: Peer connections are monitored every 30 seconds with keepalive pings
- **Smart Reconnection**: Degraded connections are automatically reinitialized
- **New Peer Handling**: Existing streams are automatically sent to peers joining late
- **Error Recovery**: Graceful handling of media device failures with user notifications
- **Preference Memory**: Remembers your video/audio preferences across sessions

#### URL Parameters
```
?room       - Specify room name
?username   - Set username
?video      - Enable video by default
```

#### Embedding
```html
<iframe src="https://meething.github.io/webrtctzn/?room=mycustomtag"
  width="100%" height="100%" frameBorder="0" allowusermedia 
  allow="microphone; camera; encrypted-media;">
</iframe>
```

##### Ingredients

* [Meething](https://github.com/meething)
* [Trystero](https://github.com/dmotz/trystero)
