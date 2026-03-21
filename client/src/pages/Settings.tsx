import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Save, Eye, EyeOff, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import api from '../lib/api';

interface AppSettings {
  fileflow_url: string;
  fileflow_access_key: string;
  deepgram_api_key: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    fileflow_url: '',
    fileflow_access_key: '',
    deepgram_api_key: '',
  });
  const [showKey, setShowKey] = useState(false);
  const [showDeepgramKey, setShowDeepgramKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await api.getAppSettings();
      setSettings({
        fileflow_url: data.fileflow_url || 'http://localhost:8680',
        fileflow_access_key: data.fileflow_access_key || '',
        deepgram_api_key: data.deepgram_api_key || '',
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
      setSettings({
        fileflow_url: 'http://localhost:8680',
        fileflow_access_key: '',
        deepgram_api_key: '',
      });
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await api.updateAppSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setConnectionStatus('unknown');
    try {
      const result = await api.testFileFlowConnection(settings.fileflow_url);
      setConnectionStatus(result.success ? 'connected' : 'failed');
    } catch (err) {
      console.error('Connection test failed:', err);
      setConnectionStatus('failed');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">App Settings</h1>
          <p className="text-gray-500">Configure integrations and preferences</p>
        </div>
      </div>

      {/* FileFlow Configuration */}
      <div className="bg-white rounded-lg border divide-y">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">FileFlow Integration</h2>
            <a
              href="http://localhost:8680"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Connect to FileFlow for storing audio, video, and other media files.
          </p>

          <div className="space-y-4">
            {/* FileFlow URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                FileFlow Server URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={settings.fileflow_url}
                  onChange={(e) => setSettings({ ...settings, fileflow_url: e.target.value })}
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="http://localhost:8680"
                />
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={testing}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                >
                  {testing ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                      Testing...
                    </>
                  ) : connectionStatus === 'connected' ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Connected
                    </>
                  ) : connectionStatus === 'failed' ? (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      Failed
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Default: http://localhost:8680 for local development
              </p>
            </div>

            {/* Access Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Key (Optional)
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={settings.fileflow_access_key}
                  onChange={(e) => setSettings({ ...settings, fileflow_access_key: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Leave empty for no authentication"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                API key for authenticated FileFlow access. Not required for local development.
              </p>
            </div>
          </div>
        </div>

        {/* Storage Info */}
        <div className="p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Storage Information</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Status</p>
                <p className="font-medium">
                  {connectionStatus === 'connected' ? (
                    <span className="text-green-600">Connected</span>
                  ) : connectionStatus === 'failed' ? (
                    <span className="text-red-600">Disconnected</span>
                  ) : (
                    <span className="text-gray-500">Not tested</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Server</p>
                <p className="font-medium truncate">{settings.fileflow_url || 'Not configured'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deepgram TTS Configuration */}
      <div className="bg-white rounded-lg border mt-6">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-1">Text-to-Speech (Deepgram)</h2>
          <p className="text-sm text-gray-500 mb-6">
            Used to generate audio narration for book chapters. Get your key at{' '}
            <a href="https://console.deepgram.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              console.deepgram.com
            </a>.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deepgram API Key
            </label>
            <div className="relative">
              <input
                type={showDeepgramKey ? 'text' : 'password'}
                value={settings.deepgram_api_key}
                onChange={(e) => setSettings({ ...settings, deepgram_api_key: e.target.value })}
                className="w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter your Deepgram API key"
              />
              <button
                type="button"
                onClick={() => setShowDeepgramKey(!showDeepgramKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showDeepgramKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to use the server's default key (if configured).
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {saved && (
            <span className="text-green-600 text-sm flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Settings saved successfully!
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
