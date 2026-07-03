'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Send, Phone, KeyRound, Lock, RefreshCw } from 'lucide-react';

type Step = 'phone' | 'code' | 'password';

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  async function post(body: object): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch('/api/telegram/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return { ok: res.ok, data };
  }

  async function handleStartOver() {
    // Tell the server to reset pending state
    await fetch('/api/telegram/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    }).catch(() => {});
    setStep('phone');
    setCode('');
    setPassword('');
    setError('');
  }

  async function handleResend() {
    setResending(true);
    setError('');
    try {
      const { ok, data } = await post({ action: 'resend', phone });
      if (!ok || data.error) throw new Error(data.error as string ?? 'Failed to resend');
      setCode('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to resend code');
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (step === 'phone') {
        const { ok, data } = await post({ action: 'start', phone });
        if (!ok || data.error) throw new Error(data.error as string ?? `Server error`);
        setStep('code');

      } else if (step === 'code') {
        const { ok, data } = await post({ action: 'verify_code', code });
        if (data.needsRestart) {
          setError((data.error as string) ?? 'Session expired');
          setStep('phone');
          return;
        }
        if (!ok || data.error) throw new Error(data.error as string ?? `Server error`);
        if (data.status === 'password_required') {
          setStep('password');
        } else {
          await triggerSync();
          router.replace('/inbox');
        }

      } else if (step === 'password') {
        const { ok, data } = await post({ action: 'verify_password', password });
        if (data.needsRestart) {
          setError((data.error as string) ?? 'Session expired');
          setStep('phone');
          return;
        }
        if (!ok || data.error) throw new Error(data.error as string ?? `Server error`);
        await triggerSync();
        router.replace('/inbox');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function triggerSync() {
    try { await fetch('/api/telegram/sync', { method: 'POST' }); } catch {}
  }

  const stepConfig = {
    phone: {
      icon: Phone,
      title: 'Sign in with Telegram',
      description: 'Enter your phone number with country code',
      label: 'Phone number',
      placeholder: '+1 234 567 8900',
      value: phone,
      onChange: setPhone,
      inputType: 'tel',
      buttonText: 'Send code',
    },
    code: {
      icon: KeyRound,
      title: 'Enter verification code',
      description: "Check your Telegram app for the code",
      label: 'Verification code',
      placeholder: '12345',
      value: code,
      onChange: setCode,
      inputType: 'text',
      buttonText: 'Verify',
    },
    password: {
      icon: Lock,
      title: 'Two-step verification',
      description: 'Enter your Telegram 2FA password',
      label: 'Password',
      placeholder: '••••••••',
      value: password,
      onChange: setPassword,
      inputType: 'password',
      buttonText: 'Sign in',
    },
  };

  const config = stepConfig[step];

  return (
    <div className="flex h-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary">
              <Send className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">Telegram CRM</span>
          </div>
        </div>

        <Card className="p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-2 mb-2 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <config.icon className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-lg font-semibold">{config.title}</h1>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="input">{config.label}</Label>
              <Input
                id="input"
                type={config.inputType}
                placeholder={config.placeholder}
                value={config.value}
                onChange={(e) => config.onChange(e.target.value)}
                autoFocus
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Loading...
                </span>
              ) : (
                config.buttonText
              )}
            </Button>

            {step === 'code' && (
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  {resending ? 'Sending...' : 'Resend code'}
                </button>
                <button
                  type="button"
                  onClick={handleStartOver}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Wrong number?
                </button>
              </div>
            )}

            {step === 'password' && (
              <button
                type="button"
                onClick={handleStartOver}
                className="text-sm text-muted-foreground hover:text-foreground text-center"
              >
                Start over
              </button>
            )}
          </form>
        </Card>

        <p className="mt-4 text-xs text-center text-muted-foreground">
          Session stored locally · Credentials from <code className="font-mono">.env.local</code>
        </p>
      </div>
    </div>
  );
}
