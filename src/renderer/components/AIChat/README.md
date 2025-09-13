# AI Chat Component

A basic AI chat interface component for the EGDesk application.

## Features

- **Real-time messaging**: Send and receive messages with a clean chat interface
- **Message history**: View conversation history with timestamps
- **Loading states**: Visual feedback when AI is processing responses
- **Responsive design**: Works on desktop and mobile devices
- **Clear chat**: Option to clear conversation history
- **Keyboard shortcuts**: Enter to send, Shift+Enter for new lines

## Usage

The component is automatically integrated into the main navigation and can be accessed via the "AI 채팅" tab.

## Current Implementation

This is a basic implementation with simulated AI responses. To connect to a real AI service:

1. Replace the simulated response in `handleSendMessage` with actual API calls
2. Configure the AI service using the API keys from the AI Keys Manager
3. Add error handling for API failures
4. Implement proper message streaming if supported by the AI service

## Props

Currently, the component doesn't accept any props and manages its own state internally.

## Styling

The component uses CSS modules with a modern chat interface design including:
- Gradient header
- Message bubbles with different styles for user and AI messages
- Smooth animations and transitions
- Custom scrollbar styling
- Mobile-responsive layout

## Future Enhancements

- Integration with actual AI services
- Message persistence
- File upload support
- Voice input/output
- Message search functionality
- Export conversation history
