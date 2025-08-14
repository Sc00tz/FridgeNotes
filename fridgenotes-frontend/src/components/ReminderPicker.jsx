import React, { useState, useEffect } from 'react';
import { Calendar, Clock, X, Bell, BellOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

const ReminderPicker = ({ reminder, onReminderChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localDate, setLocalDate] = useState('');
  const [localTime, setLocalTime] = useState('');

  // Parse existing reminder when component mounts or reminder prop changes
  useEffect(() => {
    if (reminder) {
      // Handle the datetime string properly to avoid timezone conversion
      console.log('FRONTEND DEBUG - Received reminder from backend:', reminder);
      const reminderDate = new Date(reminder);
      console.log('FRONTEND DEBUG - Parsed Date object:', reminderDate);
      const isoDate = reminderDate.toISOString().split('T')[0];
      const timeStr = reminderDate.toTimeString().slice(0, 5);
      console.log('FRONTEND DEBUG - Setting localDate/localTime:', { isoDate, timeStr });
      setLocalDate(isoDate);
      setLocalTime(timeStr);
    } else {
      setLocalDate('');
      setLocalTime('');
    }
  }, [reminder]);

  const handleDateTimeChange = () => {
    if (localDate && localTime) {
      // Create datetime string without timezone info to be treated as local time
      // This way 10:40 PM local stays as 10:40 PM in the database
      const datetimeString = `${localDate}T${localTime}:00`;
      console.log('FRONTEND DEBUG - Input values:', { localDate, localTime });
      console.log('FRONTEND DEBUG - Sending datetime string:', datetimeString);
      onReminderChange(datetimeString);
    } else {
      onReminderChange(null);
    }
  };

  const clearReminder = () => {
    setLocalDate('');
    setLocalTime('');
    onReminderChange(null);
    setIsOpen(false);
  };

  const formatReminderDisplay = () => {
    if (!reminder) return null;
    
    const reminderDate = new Date(reminder);
    const now = new Date();
    
    // Compare just the dates (ignore time) to determine if it's today, tomorrow, etc.
    const reminderDateOnly = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((reminderDateOnly.getTime() - nowDateOnly.getTime()) / (1000 * 60 * 60 * 24));
    
    const timeStr = reminderDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    if (diffDays === 0) {
      return `Today at ${timeStr}`;
    } else if (diffDays === 1) {
      return `Tomorrow at ${timeStr}`;
    } else if (diffDays === -1) {
      return `Yesterday at ${timeStr}`;
    } else if (diffDays > 0 && diffDays <= 7) {
      return `${reminderDate.toLocaleDateString([], { weekday: 'long' })} at ${timeStr}`;
    } else {
      return `${reminderDate.toLocaleDateString()} at ${timeStr}`;
    }
  };

  const isOverdue = () => {
    if (!reminder) return false;
    return new Date(reminder) < new Date();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Display current reminder or add button */}
      {reminder ? (
        <div className={`flex items-center gap-2 p-2 rounded-md border ${
          isOverdue() ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'
        }`}>
          <Bell size={16} />
          <span className="text-sm font-medium">
            {formatReminderDisplay()}
            {isOverdue() && ' (Overdue)'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearReminder}
            className="ml-auto h-6 w-6 p-0 hover:bg-red-100"
          >
            <X size={12} />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2"
        >
          <BellOff size={16} />
          Set Reminder
        </Button>
      )}

      {/* Date/Time Picker Modal */}
      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 p-4 bg-white border rounded-lg shadow-lg min-w-[280px]">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Set Reminder</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    type="date"
                    value={localDate}
                    onChange={(e) => setLocalDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time
                </label>
                <div className="relative">
                  <Clock size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    type="time"
                    value={localTime}
                    onChange={(e) => setLocalTime(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Quick presets */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Quick Options
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(9, 0, 0, 0);
                    setLocalDate(tomorrow.toISOString().split('T')[0]);
                    setLocalTime('09:00');
                  }}
                >
                  Tomorrow 9 AM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    nextWeek.setHours(9, 0, 0, 0);
                    setLocalDate(nextWeek.toISOString().split('T')[0]);
                    setLocalTime('09:00');
                  }}
                >
                  Next Week
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  handleDateTimeChange();
                  setIsOpen(false);
                }}
                disabled={!localDate || !localTime}
                className="flex-1"
              >
                Set Reminder
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReminderPicker;