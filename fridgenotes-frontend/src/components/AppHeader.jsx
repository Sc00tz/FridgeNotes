import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  User, 
  Settings, 
  Archive, 
  ArchiveRestore,
  LogOut,
  Shield,
  Tag
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ThemeToggle from './ThemeToggle';

const AppHeader = ({ 
  searchTerm, 
  onSearchChange, 
  showArchived, 
  onToggleArchived,
  currentUser,
  onOpenProfile,
  onOpenAdmin,
  onOpenLabels,
  onLogout 
}) => {
  return (
    <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <img 
              src="/FridgeNotesLogo.jpeg" 
              alt="FridgeNotes Logo" 
              className="h-8 w-8 rounded object-cover"
            />
            <span className="font-bold">FridgeNotes</span>
          </div>
          
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search notes..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant={showArchived ? "default" : "ghost"}
            size="sm"
            onClick={onToggleArchived}
          >
            {showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            <span className="hidden sm:inline ml-1">
              {showArchived ? 'Show Active' : 'Show Archived'}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenLabels}
          >
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Labels</span>
          </Button>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <User className="h-4 w-4" />
                <span className="ml-1">{currentUser?.username}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenProfile}>
                <Settings className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              {currentUser?.is_admin && (
                <DropdownMenuItem onClick={onOpenAdmin}>
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Panel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
