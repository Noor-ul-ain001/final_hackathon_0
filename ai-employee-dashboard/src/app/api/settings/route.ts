import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const VAULT_PATH = process.env.VAULT_PATH || path.join(process.cwd(), '..', 'AI_Employee_Vault');
const SETTINGS_FILE = path.join(VAULT_PATH, 'settings.json');

const DEFAULT_SETTINGS = {
  watchers: {
    gmail: true,
    whatsapp: true,
    finance: false,
    linkedin: true,
    scheduler: true,
    auditor: true,
  },
  notifications: {
    email_notifications: true,
    push_notifications: true,
    approval_required: true,
    system_alerts: true,
  },
  autoApproveThreshold: 50,
  devMode: false,
  updatedAt: null as string | null,
};

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const saved = JSON.parse(content);
      return {
        ...DEFAULT_SETTINGS,
        ...saved,
        watchers: { ...DEFAULT_SETTINGS.watchers, ...(saved.watchers || {}) },
        notifications: { ...DEFAULT_SETTINGS.notifications, ...(saved.notifications || {}) },
      };
    }
  } catch (error) {
    console.error('Failed to read settings file:', error);
  }
  return DEFAULT_SETTINGS;
}

export async function GET() {
  const settings = readSettings();
  return NextResponse.json({ success: true, settings });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const settings = {
      watchers: { ...DEFAULT_SETTINGS.watchers, ...(body.watchers || {}) },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(body.notifications || {}) },
      autoApproveThreshold: typeof body.autoApproveThreshold === 'number'
        ? Math.max(0, Math.min(10000, body.autoApproveThreshold))
        : DEFAULT_SETTINGS.autoApproveThreshold,
      devMode: typeof body.devMode === 'boolean' ? body.devMode : DEFAULT_SETTINGS.devMode,
      updatedAt: new Date().toISOString(),
    };

    // Ensure vault directory exists before writing
    if (!fs.existsSync(VAULT_PATH)) {
      fs.mkdirSync(VAULT_PATH, { recursive: true });
    }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Failed to save settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
