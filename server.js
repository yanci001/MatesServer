const express = require('express');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;

// Create HTTP server
const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

let users = []; // Store connected users
let groups = {}; // Store active groups

// Handle new WebSocket connections
wss.on('connection', (ws) => {
  console.log('New connection established');

  // Handle incoming messages
  ws.on('message', (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'join':
        users.push({ ws, interests: data.interests, id: users.length + 1 });
        matchUsers();
        break;

      case 'message':
        sendMessageToGroup(data.groupId, data.message, data.userId);
        break;

      case 'leave':
        leaveGroup(data.userId, data.groupId);
        break;

      // WebRTC signaling
      case 'offer':
        handleOffer(data);
        break;

      case 'answer':
        handleAnswer(data);
        break;

      case 'candidate':
        handleCandidate(data);
        break;
    }
  });

  // Handle connection close
  ws.on('close', () => {
    console.log('Connection closed');
    users = users.filter(user => user.ws !== ws);
  });
});

// Function to match users into groups
function matchUsers() {
  const userGroups = {};

  users.forEach((user) => {
    const interests = user.interests;
    if (!userGroups[interests]) {
      userGroups[interests] = [];
    }
    userGroups[interests].push(user);
  });

  // Create groups of 4–6 users
  for (const interest in userGroups) {
    while (userGroups[interest].length >= 4) {
      const group = userGroups[interest].splice(0, 6);
      const groupId = `${interest}-${Date.now()}`;
      groups[groupId] = group;
      
      // Notify users in the group
      group.forEach(user => {
        user.ws.send(JSON.stringify({ type: 'group_formed', groupId }));
      });
    }
  }
}

// Function to send messages to a group
function sendMessageToGroup(groupId, message, userId) {
  const group = groups[groupId];
  if (group) {
    group.forEach(user => {
      user.ws.send(JSON.stringify({ type: 'message', message, userId }));
    });
  }
}

// Function to handle user leaving a group
function leaveGroup(userId, groupId) {
  const group = groups[groupId];
  if (group) {
    groups[groupId] = group.filter(user => user.id !== userId);
    // Optionally notify users in the group
  }
}

// WebRTC signaling functions
function handleOffer(data) {
  const { offer, userId, targetUserId } = data;
  const targetUser = users.find(user => user.id === targetUserId);
  if (targetUser) {
    targetUser.ws.send(JSON.stringify({ type: 'offer', offer, userId }));
  }
}

function handleAnswer(data) {
  const { answer, userId, targetUserId } = data;
  const targetUser = users.find(user => user.id === targetUserId);
  if (targetUser) {
    targetUser.ws.send(JSON.stringify({ type: 'answer', answer, userId }));
  }
}

function handleCandidate(data) {
  const { candidate, userId, targetUserId } = data;
  const targetUser = users.find(user => user.id === targetUserId);
  if (targetUser) {
    targetUser.ws.send(JSON.stringify({ type: 'candidate', candidate, userId }));
  }
}
