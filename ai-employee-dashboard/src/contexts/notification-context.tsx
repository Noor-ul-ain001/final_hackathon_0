'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Initial notifications for the app
const getInitialNotifications = (): Notification[] => [
  {
    id: '1',
    title: 'New Email Received',
    message: 'Important email from Client A',
    type: 'info',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    read: false
  },
  {
    id: '2',
    title: 'Payment Processed',
    message: 'Payment of $1,250.00 processed successfully',
    type: 'success',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    read: false
  },
  {
    id: '3',
    title: 'Approval Required',
    message: 'Payment approval needed for Vendor X',
    type: 'warning',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    read: true
  }
];

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>(getInitialNotifications);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // In a real app, this would come from a WebSocket connection
      const randomEvents: { title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }[] = [
        {
          title: 'New WhatsApp Message',
          message: 'Client C sent a message about the project',
          type: 'info'
        },
        {
          title: 'Task Completed',
          message: 'Weekly social media posts scheduled',
          type: 'success'
        },
        {
          title: 'System Alert',
          message: 'Gmail Watcher detected unusual activity',
          type: 'warning'
        },
        {
          title: 'Error Occurred',
          message: 'Finance Watcher failed to connect to bank API',
          type: 'error'
        }
      ];

      const randomEvent = randomEvents[Math.floor(Math.random() * randomEvents.length)];

      // Randomly add a notification occasionally
      if (Math.random() > 0.7) {
        const newNotification: Omit<Notification, 'id' | 'timestamp' | 'read'> = {
          title: randomEvent.title,
          message: randomEvent.message,
          type: randomEvent.type
        };

        addNotification(newNotification);
      }
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [addNotification]);

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider 
      value={{ 
        notifications, 
        unreadCount, 
        addNotification, 
        markAsRead, 
        markAllAsRead 
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};