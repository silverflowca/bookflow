import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, colorSchemes, ColorSchemeKey } from '../../contexts/ThemeContext';
import { BookOpen, User, LogOut, Plus, Settings, Sun, Moon, Check, Palette } from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';

export default function Layout() {
  const { user, profile, logout } = useAuth();
  const { colorScheme, setColorScheme } = useTheme();
  const navigate = useNavigate();
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/');
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

            {/* Navigation */}
            <nav className="flex items-center gap-4">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    className="text-muted hover:text-theme px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    My Books
                  </Link>
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-1 theme-button-primary px-4 py-2 rounded-md text-sm font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    New Book
                  </Link>
                  <div className="flex items-center gap-3 ml-4 pl-4 border-l-2 border-strong">
                    <NotificationBell />
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-surface-hover flex items-center justify-center border-2 border-theme">
                        <User className="h-4 w-4 text-accent" />
                      </div>
                      <span className="text-sm font-medium text-theme">
                        {profile?.display_name || user.email}
                      </span>
                    </div>

                    {/* Settings with Theme Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                        className="text-muted hover:text-theme p-2 rounded-md transition-colors hover:bg-surface-hover"
                        title="Theme Settings"
                      >
                        <Settings className="h-5 w-5" />
                      </button>

                      {showThemeDropdown && (
                        <div className="absolute right-0 mt-2 w-72 theme-modal rounded-lg z-50 overflow-hidden">
                          {/* Header */}
                          <div className="px-4 py-3 border-b-2 border-theme flex items-center gap-2">
                            <Palette className="h-4 w-4 text-accent" />
                            <span className="font-semibold text-theme">Color Theme</span>
                          </div>

                          {/* Light Themes */}
                          <div className="p-3">
                            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted uppercase tracking-wider">
                              <Sun className="h-3.5 w-3.5" />
                              Light Themes
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              {lightSchemes.map(([key, scheme]) => (
                                <button
                                  key={key}
                                  onClick={() => setColorScheme(key as ColorSchemeKey)}
                                  className={`group relative`}
                                  title={scheme.name}
                                >
                                  <div
                                    className={`color-swatch ${colorScheme === key ? 'active' : ''}`}
                                    style={{ backgroundColor: scheme.accent }}
                                  >
                                    {colorScheme === key && (
                                      <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow-md" />
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted mt-1 block truncate">
                                    {scheme.name}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Dark Themes */}
                          <div className="p-3 border-t-2 border-theme">
                            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted uppercase tracking-wider">
                              <Moon className="h-3.5 w-3.5" />
                              Dark Themes
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              {darkSchemes.map(([key, scheme]) => (
                                <button
                                  key={key}
                                  onClick={() => setColorScheme(key as ColorSchemeKey)}
                                  className={`group relative`}
                                  title={scheme.name}
                                >
                                  <div
                                    className={`color-swatch ${colorScheme === key ? 'active' : ''}`}
                                    style={{ backgroundColor: scheme.accent }}
                                  >
                                    {colorScheme === key && (
                                      <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow-md" />
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted mt-1 block truncate">
                                    {scheme.name}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Other Settings Link */}
                          <Link
                            to="/settings"
                            onClick={() => setShowThemeDropdown(false)}
                            className="flex items-center gap-2 px-4 py-3 border-t-2 border-theme text-sm text-muted hover:text-theme hover:bg-surface-hover transition-colors"
                          >
                            <Settings className="h-4 w-4" />
                            More Settings...
                          </Link>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleLogout}
                      className="text-muted hover:text-theme p-2 rounded-md transition-colors hover:bg-surface-hover"
                      title="Logout"
                    >
                      <LogOut className="h-5 w-5" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-muted hover:text-theme px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="theme-button-primary px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t-2 border-strong mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
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
