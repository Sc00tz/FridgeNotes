import React, { useState, useEffect } from 'react';
import { Bell, Clock, CheckCircle, AlarmClock, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

const ReminderNotifications = ({ notes = [], onMarkComplete, onSnooze, onDismiss }) => {
  const [activeReminders, setActiveReminders] = useState([]);

  // Filter notes that have active reminders
  useEffect(() => {
    console.log('NOTIFICATION DEBUG - All notes:', notes);
    const now = new Date();
    console.log('NOTIFICATION DEBUG - Current time:', now);
    
    const reminders = notes.filter(note => {
      console.log('NOTIFICATION DEBUG - Checking note:', {
        id: note.id,
        title: note.title,
        reminder_datetime: note.reminder_datetime,
        reminder_completed: note.reminder_completed,
        reminder_snoozed_until: note.reminder_snoozed_until
      });
      
      if (!note.reminder_datetime || note.reminder_completed) {
        console.log('NOTIFICATION DEBUG - Filtered out: no reminder or completed');
        return false;
      }
      
      const reminderTime = new Date(note.reminder_datetime);
      const snoozeTime = note.reminder_snoozed_until ? new Date(note.reminder_snoozed_until) : null;
      
      console.log('NOTIFICATION DEBUG - Times:', {
        reminderTime,
        snoozeTime,
        now,
        isReminderDue: reminderTime <= now
      });
      
      // Show if reminder time has passed and not snoozed, or snooze time has passed
      if (snoozeTime && snoozeTime > now) {
        console.log('NOTIFICATION DEBUG - Still snoozed');
        return false; // Still snoozed
      }
      
      const shouldShow = reminderTime <= now;
      console.log('NOTIFICATION DEBUG - Should show notification:', shouldShow);
      return shouldShow;
    });

    console.log('NOTIFICATION DEBUG - Active reminders found:', reminders);
    setActiveReminders(reminders);
  }, [notes]);

  const formatReminderTime = (reminderDateTime) => {
    const reminderDate = new Date(reminderDateTime);
    const now = new Date();
    const diffMs = now.getTime() - reminderDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  const handleSnooze = (noteId, duration) => {
    const snoozeUntil = new Date();
    snoozeUntil.setMinutes(snoozeUntil.getMinutes() + duration);
    onSnooze(noteId, snoozeUntil.toISOString());
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  // Request notification permission on component mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Show browser notifications for new reminders
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      activeReminders.forEach(note => {
        // Only show notification if reminder is recent (within last 5 minutes)
        const reminderTime = new Date(note.reminder_datetime);
        const now = new Date();
        const diffMinutes = (now.getTime() - reminderTime.getTime()) / (1000 * 60);
        
        if (diffMinutes <= 5) {
          new Notification(`Reminder: ${note.title || 'Untitled Note'}`, {
            body: note.content ? note.content.substring(0, 100) + '...' : 'Your reminder is ready',
            icon: '/pwa-192x192.png',
            tag: `reminder-${note.id}`, // Prevents duplicate notifications
          });
        }
      });
    }
  }, [activeReminders]);

  if (activeReminders.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
      {activeReminders.map(note => (
        <Card key={note.id} className="p-4 bg-white border-l-4 border-l-blue-500 shadow-lg">
          <div className="flex items-start gap-3">
            <Bell className="text-blue-500 mt-1" size={20} />
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate">
                {note.title || 'Untitled Note'}
              </h4>
              {note.content && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {note.content.substring(0, 100)}
                  {note.content.length > 100 && '...'}
                </p>
              )}
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                <Clock size={12} />
                <span>{formatReminderTime(note.reminder_datetime)}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(note.id)}
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </Button>
          </div>
          
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={() => onMarkComplete(note.id)}
              className="flex items-center gap-1"
            >
              <CheckCircle size={14} />
              Complete
            </Button>
            
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSnooze(note.id, 15)}
                className="flex items-center gap-1"
              >
                <AlarmClock size={14} />
                15m
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSnooze(note.id, 60)}
                className="flex items-center gap-1"
              >
                <AlarmClock size={14} />
                1h
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default ReminderNotifications;