import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, colorSchemes, ColorSchemeKey } from '../../contexts/ThemeContext';
import { BookOpen, User, LogOut, Plus, Settings, Sun, Moon, Check, Palette, Menu, X } from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';

export default function Layout() {
  const { user, profile, logout } = useAuth();
  const { colorScheme, setColorScheme } = useTheme();
  const navigate = useNavigate();
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setShowMobileMenu(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowThemeDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Group color schemes by mode
  const lightSchemes = Object.entries(colorSchemes).filter(([_, s]) => s.mode === 'light');
  const darkSchemes = Object.entries(colorSchemes).filter(([_, s]) => s.mode === 'dark');

  const ThemeDropdownContent = () => (
    <div className="theme-modal rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b-2 border-theme flex items-center gap-2">
        <Palette className="h-4 w-4 text-accent" />
        <span className="font-semibold text-theme">Color Theme</span>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted uppercase tracking-wider">
          <Sun className="h-3.5 w-3.5" /> Light Themes
        </div>
        <div className="grid grid-cols-4 gap-2">
          {lightSchemes.map(([key, scheme]) => (
            <button key={key} onClick={() => { setColorScheme(key as ColorSchemeKey); setShowMobileMenu(false); }} className="group relative" title={scheme.name}>
              <div className={`color-swatch ${colorScheme === key ? 'active' : ''}`} style={{ backgroundColor: scheme.accent }}>
                {colorScheme === key && <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow-md" />}
              </div>
              <span className="text-[10px] text-muted mt-1 block truncate">{scheme.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 border-t-2 border-theme">
        <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted uppercase tracking-wider">
          <Moon className="h-3.5 w-3.5" /> Dark Themes
        </div>
        <div className="grid grid-cols-4 gap-2">
          {darkSchemes.map(([key, scheme]) => (
            <button key={key} onClick={() => { setColorScheme(key as ColorSchemeKey); setShowMobileMenu(false); }} className="group relative" title={scheme.name}>
              <div className={`color-swatch ${colorScheme === key ? 'active' : ''}`} style={{ backgroundColor: scheme.accent }}>
                {colorScheme === key && <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow-md" />}
              </div>
              <span className="text-[10px] text-muted mt-1 block truncate">{scheme.name}</span>
            </button>
          ))}
        </div>
      </div>
      <Link to="/settings" onClick={() => { setShowThemeDropdown(false); setShowMobileMenu(false); }}
        className="flex items-center gap-2 px-4 py-3 border-t-2 border-theme text-sm text-muted hover:text-theme hover:bg-surface-hover transition-colors">
        <Settings className="h-4 w-4" /> More Settings...
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-theme">
      {/* Header */}
      <header className="theme-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 text-accent hover:opacity-80 transition-opacity">
              <BookOpen className="h-8 w-8" />
              <span className="text-xl font-bold">BookFlow</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4">
              {user ? (
                <>
                  <Link to="/dashboard" className="text-muted hover:text-theme px-3 py-2 rounded-md text-sm font-medium transition-colors">
                    My Books
                  </Link>
                  <Link to="/dashboard" className="flex items-center gap-1 theme-button-primary px-4 py-2 rounded-md text-sm font-medium">
                    <Plus className="h-4 w-4" /> New Book
                  </Link>
                  <div className="flex items-center gap-3 ml-4 pl-4 border-l-2 border-strong">
                    <NotificationBell />
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-surface-hover flex items-center justify-center border-2 border-theme">
                        <User className="h-4 w-4 text-accent" />
                      </div>
                      <span className="text-sm font-medium text-theme">{profile?.display_name || user.email}</span>
                    </div>
                    <div className="relative" ref={dropdownRef}>
                      <button onClick={() => setShowThemeDropdown(!showThemeDropdown)} className="text-muted hover:text-theme p-2 rounded-md transition-colors hover:bg-surface-hover" title="Theme Settings">
                        <Settings className="h-5 w-5" />
                      </button>
                      {showThemeDropdown && (
                        <div className="absolute right-0 mt-2 w-72 z-50">
                          <ThemeDropdownContent />
                        </div>
                      )}
                    </div>
                    <button onClick={handleLogout} className="text-muted hover:text-theme p-2 rounded-md transition-colors hover:bg-surface-hover" title="Logout">
                      <LogOut className="h-5 w-5" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-muted hover:text-theme px-3 py-2 rounded-md text-sm font-medium transition-colors">Login</Link>
                  <Link to="/register" className="theme-button-primary px-4 py-2 rounded-md text-sm font-medium">Sign Up</Link>
                </>
              )}
            </nav>

            {/* Mobile right side */}
            <div className="flex md:hidden items-center gap-2">
              {user && <NotificationBell />}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="text-muted hover:text-theme p-2 rounded-md transition-colors hover:bg-surface-hover"
              >
                {showMobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t-2 border-theme bg-surface px-4 py-4 space-y-3">
            {user ? (
              <>
                <div className="flex items-center gap-3 pb-3 border-b border-theme">
                  <div className="h-8 w-8 rounded-full bg-surface-hover flex items-center justify-center border-2 border-theme">
                    <User className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-sm font-medium text-theme">{profile?.display_name || user.email}</span>
                </div>
                <Link to="/dashboard" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-2 py-2 text-sm font-medium text-theme">
                  <BookOpen className="h-4 w-4 text-accent" /> My Books
                </Link>
                <Link to="/dashboard" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-2 py-2 text-sm font-medium theme-button-primary px-3 rounded-md">
                  <Plus className="h-4 w-4" /> New Book
                </Link>
                <div className="border-t border-theme pt-3">
                  <ThemeDropdownContent />
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 py-2 text-sm text-red-600 w-full">
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setShowMobileMenu(false)} className="flex items-center py-2 text-sm font-medium text-theme">Login</Link>
                <Link to="/register" onClick={() => setShowMobileMenu(false)} className="flex items-center py-2 text-sm font-medium theme-button-primary px-4 rounded-md">Sign Up</Link>
              </>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t-2 border-strong mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <p className="text-sm text-muted">
              &copy; {new Date().getFullYear()} BookFlow. Interactive book platform.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-sm text-muted hover:text-theme transition-colors">About</a>
              <a href="#" className="text-sm text-muted hover:text-theme transition-colors">Help</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
