# AI Employee Dashboard

A Next.js dashboard for monitoring and managing your Personal AI Employee system. This dashboard provides a web-based interface to interact with your AI Employee, which operates using Claude Code, Obsidian vault, and various watchers as described in the hackathon document.

## Features

- **Dashboard**: Overview of key metrics like bank balance, pending actions, completed tasks, and revenue
- **Approval Queue**: Interface to review and approve actions taken by your AI Employee
- **Vault Browser**: Browse and manage files in your Obsidian vault structure
- **Settings**: Configure watchers and preferences for your AI Employee
- **CEO Briefing Generator**: Create automated business reports and insights
- **Real-time Notifications**: Receive updates about system events and actions

## Architecture

This dashboard complements the AI Employee architecture described in the hackathon document:

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS DASHBOARD                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐  │
│  │   Dashboard     │ │  Approval       │ │   Vault         │  │
│  │   Page          │ │  Queue          │ │   Browser       │  │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐  │
│  │   Settings      │ │  CEO Briefing   │ │ Notifications   │  │
│  │   Page          │ │  Generator      │ │   System        │  │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 AI EMPLOYEE BACKEND INTEGRATION               │
│  (Simulated in this demo - would connect to actual system)    │
└─────────────────────────────────────────────────────────────────┘
```

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the dashboard.

## Integration with AI Employee System

In a production setup, this dashboard would connect to your AI Employee system through:

1. **File System Integration**: Reading from your Obsidian vault directories (Needs_Action, Plans, Done, etc.)
2. **API Endpoints**: Communicating with your Claude Code orchestrator
3. **Real-time Updates**: Using WebSockets to receive notifications from watchers
4. **MCP Integration**: Interfacing with Model Context Protocol servers

Currently, the dashboard simulates these integrations with mock data to demonstrate the UI/UX.

## Pages

- `/` - Main dashboard with metrics and recent activity
- `/approvals` - Approval queue for pending actions
- `/vault` - File browser for vault contents
- `/settings` - Configuration for watchers and preferences
- `/briefings` - CEO briefing generator

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **UI Components**: Custom components based on shadcn/ui
- **Icons**: Lucide React
- **State Management**: React Context API
- **Types**: TypeScript

## Learn More

To learn more about the AI Employee system this dashboard connects to, check out the [hackathon document](../../hackathon.md).

## Deployment

The dashboard can be deployed to any platform that supports Next.js applications, such as Vercel, Netlify, or AWS.

For deployment instructions, see the [Next.js deployment documentation](https://nextjs.org/docs/deployment).