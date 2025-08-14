import React from 'react';
import { Bell, BellOff, Clock } from 'lucide-react';

const ReminderBadge = ({ reminder, completed = false, className = '' }) => {
  if (!reminder || completed) {
    return null;
  }

  const reminderDate = new Date(reminder);
  const now = new Date();
  const isOverdue = reminderDate < now;
  const diffMs = reminderDate.getTime() - now.getTime();
  const diffHours = Math.abs(diffMs) / (1000 * 60 * 60);
  const diffDays = Math.abs(diffMs) / (1000 * 60 * 60 * 24);

  const getTimeDisplay = () => {
    if (isOverdue) {
      if (diffHours < 1) {
        return 'Due now';
      } else if (diffHours < 24) {
        return `${Math.floor(diffHours)}h overdue`;
      } else {
        return `${Math.floor(diffDays)}d overdue`;
      }
    } else {
      if (diffHours < 1) {
        return `${Math.ceil(diffMs / (1000 * 60))}m`;
      } else if (diffHours < 24) {
        return `${Math.ceil(diffHours)}h`;
      } else if (diffDays < 7) {
        return `${Math.ceil(diffDays)}d`;
      } else {
        return reminderDate.toLocaleDateString([], { 
          month: 'short', 
          day: 'numeric' 
        });
      }
    }
  };

  const getBadgeStyles = () => {
    if (isOverdue) {
      return 'bg-red-100 text-red-700 border-red-200';
    } else if (diffHours < 2) {
      return 'bg-orange-100 text-orange-700 border-orange-200';
    } else if (diffHours < 24) {
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    } else {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getIcon = () => {
    if (isOverdue) {
      return <Bell size={12} className="animate-pulse" />;
    } else {
      return <Clock size={12} />;
    }
  };

  return (
    <div className={`
      inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium
      ${getBadgeStyles()}
      ${className}
    `}>
      {getIcon()}
      <span>{getTimeDisplay()}</span>
    </div>
  );
};

export default ReminderBadge;